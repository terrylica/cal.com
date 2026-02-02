import type { ArgumentsHost, ExceptionFilter } from "@nestjs/common";
import { Catch } from "@nestjs/common";
import type { Response } from "express";
import { OAuth2HttpException } from "@/modules/auth/oauth2/filters/oauth2-http.exception";

@Catch(OAuth2HttpException)
export class OAuth2HttpExceptionFilter implements ExceptionFilter<OAuth2HttpException> {
  catch(exception: OAuth2HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    response.status(exception.getStatus()).json(exception.oAuthErrorData);
  }
}
