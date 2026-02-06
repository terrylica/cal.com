import {
  BOOKING_READ,
  BOOKING_WRITE,
  EVENT_TYPE_READ,
  EVENT_TYPE_WRITE,
  PROFILE_READ,
  SCHEDULE_READ,
  SCHEDULE_WRITE,
  X_CAL_CLIENT_ID,
} from "@calcom/platform-constants";
import { hasPermissions } from "@calcom/platform-utils";
import type { PlatformOAuthClient } from "@calcom/prisma/client";
import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Reflector } from "@nestjs/core";
import { getToken } from "next-auth/jwt";
import { isApiKey } from "@/lib/api-key";
import { Permissions } from "@/modules/auth/decorators/permissions/permissions.decorator";
import { OAuthClientRepository } from "@/modules/oauth-clients/oauth-client.repository";
import { OAuthClientsOutputService } from "@/modules/oauth-clients/services/oauth-clients/oauth-clients-output.service";
import { TokensRepository } from "@/modules/tokens/tokens.repository";
import { TokensService } from "@/modules/tokens/tokens.service";

const SCOPE_TO_PERMISSION: Record<string, number> = {
  EVENT_TYPE_READ: EVENT_TYPE_READ,
  EVENT_TYPE_WRITE: EVENT_TYPE_WRITE,
  BOOKING_READ: BOOKING_READ,
  BOOKING_WRITE: BOOKING_WRITE,
  SCHEDULE_READ: SCHEDULE_READ,
  SCHEDULE_WRITE: SCHEDULE_WRITE,
  PROFILE_READ: PROFILE_READ,
};

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private tokensRepository: TokensRepository,
    private tokensService: TokensService,
    private readonly config: ConfigService,
    private readonly oAuthClientRepository: OAuthClientRepository,
    private readonly oAuthClientsOutputService: OAuthClientsOutputService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.get(Permissions, context.getHandler());

    if (!requiredPermissions?.length || !Object.keys(requiredPermissions)?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const bearerToken = request.get("Authorization")?.replace("Bearer ", "");
    const nextAuthSecret = this.config.get("next.authSecret", { infer: true });
    const nextAuthToken = await getToken({ req: request, secret: nextAuthSecret });
    const oAuthClientId = request.params?.clientId || request.get(X_CAL_CLIENT_ID);
    const apiKey = bearerToken && isApiKey(bearerToken, this.config.get("api.apiKeyPrefix") ?? "cal_");
    const decodedThirdPartyToken = bearerToken ? this.getDecodedThirdPartyAccessToken(bearerToken) : null;

    // NextAuth sessions and API keys have full access
    if (nextAuthToken || apiKey) {
      return true;
    }

    if (decodedThirdPartyToken) {
      return this.checkThirdPartyTokenPermissions(decodedThirdPartyToken, requiredPermissions);
    }

    if (!bearerToken && !oAuthClientId) {
      throw new ForbiddenException(
        "PermissionsGuard - no authentication provided. Provide either authorization bearer token containing managed user access token or oAuth client id in 'x-cal-client-id' header."
      );
    }

    const oAuthClient = bearerToken
      ? await this.getOAuthClientByAccessToken(bearerToken)
      : await this.getOAuthClientById(oAuthClientId);

    const hasRequiredPermissions = hasPermissions(oAuthClient.permissions, [...requiredPermissions]);

    if (!hasRequiredPermissions) {
      throw new ForbiddenException(
        `PermissionsGuard - oAuth client with id=${
          oAuthClient.id
        } does not have the required permissions=${requiredPermissions
          .map((permission) => this.oAuthClientsOutputService.transformOAuthClientPermission(permission))
          .join(
            ", "
          )}. Go to platform dashboard settings and add the required permissions to the oAuth client.`
      );
    }

    return true;
  }

  async getOAuthClientByAccessToken(
    accessToken: string
  ): Promise<Pick<PlatformOAuthClient, "id" | "permissions">> {
    const oAuthClient = await this.tokensRepository.getAccessTokenClient(accessToken);
    if (!oAuthClient) {
      throw new ForbiddenException(
        `PermissionsGuard - no oAuth client found for access token=${accessToken}`
      );
    }
    return oAuthClient;
  }

  async getOAuthClientById(id: string): Promise<Pick<PlatformOAuthClient, "id" | "permissions">> {
    const oAuthClient = await this.oAuthClientRepository.getOAuthClient(id);
    if (!oAuthClient) {
      throw new ForbiddenException(`PermissionsGuard - no oAuth client found for client id=${id}`);
    }
    return oAuthClient;
  }

  checkThirdPartyTokenPermissions(
    decodedToken: { scope?: string[] },
    requiredPermissions: number[]
  ): boolean {
    const tokenScopes: string[] = decodedToken.scope ?? [];

    if (tokenScopes.length === 0) {
      return true;
    }

    const tokenPermissions = this.resolveTokenPermissions(tokenScopes);

    // note(Lauris): legacy access tokens either did not have scopes defined or had legacy scopes defined,
    // if so give full access just like we have been doing up until now.
    if (tokenPermissions.size === 0) {
      return true;
    }

    const missing = requiredPermissions.filter((permission) => !tokenPermissions.has(permission));
    if (missing.length > 0) {
      const missingNames = missing
        .map((permission) => Object.entries(SCOPE_TO_PERMISSION).find(([, value]) => value === permission)?.[0] ?? `UNKNOWN(${permission})`)
        .filter(Boolean);
      throw new ForbiddenException(
        `insufficient_scope: token does not have the required scopes. Required: ${missingNames.join(", ")}. Token has: ${tokenScopes.join(", ")}`
      );
    }

    return true;
  }

  private resolveTokenPermissions(scopes: string[]): Set<number> {
    const permissions = new Set<number>();
    for (const scope of scopes) {
      const permission = SCOPE_TO_PERMISSION[scope];
      if (permission !== undefined) {
        permissions.add(permission);
      }
    }
    return permissions;
  }

  getDecodedThirdPartyAccessToken(bearerToken: string) {
    return this.tokensService.getDecodedThirdPartyAccessToken(bearerToken);
  }
}
