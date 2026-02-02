import { ErrorWithCode, getHttpStatusCode } from "@calcom/platform-libraries/errors";
import { HttpException, Injectable, InternalServerErrorException, Logger } from "@nestjs/common";
import { OAuthService } from "@/lib/services/oauth.service";
import { OAuth2RedirectException } from "@/modules/auth/oauth2/filters/oauth2-redirect.exception";

const NON_REDIRECTABLE_REASONS: Set<string> = new Set([
  "client_not_found",
  "client_not_approved",
  "redirect_uri_mismatch",
]);

const OAUTH_ERROR_DESCRIPTIONS: Record<string, string> = {
  client_not_found: "OAuth client with ID not found",
  client_not_approved: "OAuth client is not approved",
  redirect_uri_mismatch: "redirect_uri does not match OAuth client's redirect URI",
  pkce_required: "code_challenge required for public clients",
  invalid_code_challenge_method: "code_challenge_method must be S256",
  team_not_found_or_no_access: "Team not found or user is not an admin/owner",
  access_denied: "The resource owner or authorization server denied the request.",
  invalid_client_credentials: "Invalid client credentials",
  code_invalid_or_expired: "Authorization code is invalid or expired",
  pkce_missing_parameters_or_invalid_method: "PKCE parameters missing or invalid method",
  pkce_verification_failed: "PKCE verification failed",
  invalid_refresh_token: "Refresh token is invalid",
  client_id_mismatch: "Client ID mismatch",
  encryption_key_missing: "CALENDSO_ENCRYPTION_KEY is not set",
};

function getErrorDescription(reason: string | undefined, fallbackMessage: string): string {
  if (reason && reason in OAUTH_ERROR_DESCRIPTIONS) {
    return OAUTH_ERROR_DESCRIPTIONS[reason];
  }
  return reason ?? fallbackMessage;
}

@Injectable()
export class OAuth2ErrorService {
  private readonly logger = new Logger("OAuth2ErrorService");

  constructor(private readonly oAuthService: OAuthService) {}

  handleAuthorizeError(err: unknown, redirectUri: string, state?: string): never {
    if (err instanceof ErrorWithCode) {
      const reason = err.data?.reason as string | undefined;

      if (reason && NON_REDIRECTABLE_REASONS.has(reason)) {
        const statusCode = getHttpStatusCode(err);
        throw new HttpException(
          {
            error: err.message,
            error_description: getErrorDescription(reason, err.message),
          },
          statusCode
        );
      }
    }

    const errorRedirectUrl = this.oAuthService.buildErrorRedirectUrl(redirectUri, err, state);
    throw new OAuth2RedirectException(errorRedirectUrl);
  }

  handleTokenError(err: unknown): never {
    if (err instanceof ErrorWithCode) {
      const statusCode = getHttpStatusCode(err);
      const reason = err.data?.reason as string | undefined;
      throw new HttpException(
        {
          error: err.message,
          error_description: getErrorDescription(reason, err.message),
        },
        statusCode
      );
    }
    this.logger.error(err);
    throw new HttpException(
      {
        error: "server_error",
        error_description: "An unexpected error occurred",
      },
      500
    );
  }

  handleClientError(err: unknown, fallbackMessage: string): never {
    if (err instanceof ErrorWithCode) {
      const statusCode = getHttpStatusCode(err);
      if (statusCode >= 500) {
        this.logger.error(err);
      }
      throw new HttpException(err.message, statusCode);
    }
    this.logger.error(err);
    throw new InternalServerErrorException(fallbackMessage);
  }
}
