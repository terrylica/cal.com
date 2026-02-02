import type { Params } from "app/_types";
import { ApiError } from "next/dist/server/api-utils";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { HttpError } from "@calcom/lib/http-error";
import { getServerErrorFromUnknown } from "@calcom/lib/server/getServerErrorFromUnknown";
import { performance } from "@calcom/lib/server/perfObserver";
import { resolveTenantById } from "@calcom/lib/server/tenant";
import { runWithTenant } from "@calcom/prisma/tenant-context";

import { TRPCError } from "@trpc/server";
import { getHTTPStatusCodeFromError } from "@trpc/server/http";

type Handler<T extends NextResponse | Response = NextResponse> = (
  req: NextRequest,
  { params }: { params: Promise<Params> }
) => Promise<T>;

export const defaultResponderForAppDir = <T extends NextResponse | Response = NextResponse>(
  handler: Handler<T>,
  endpointRoute?: string
) => {
  return async (req: NextRequest, { params }: { params: Promise<Params> }) => {
    const tenantId = req.headers.get("x-tenant-id");
    const tenantInfo = tenantId ? resolveTenantById(tenantId) : null;

    const executeHandler = async (): Promise<T | undefined> => {
      if (process.env.NODE_ENV === "development" || !endpointRoute) {
        return handler(req, { params });
      }
      const { wrapApiHandlerWithSentry } = await import("@sentry/nextjs");
      return wrapApiHandlerWithSentry(async () => await handler(req, { params }), endpointRoute)();
    };

    let ok = false;
    try {
      performance.mark("Start");
      const result = tenantInfo
        ? await runWithTenant(tenantInfo, executeHandler)
        : await executeHandler();

      ok = true;
      if (result) {
        return result;
      }

      return NextResponse.json({});
    } catch (error) {
      let serverError: HttpError;

      if (error instanceof TRPCError) {
        const statusCode = getHTTPStatusCodeFromError(error);
        serverError = new HttpError({ statusCode, message: error.message });
      } else if (error instanceof ApiError) {
        serverError = new HttpError({
          message: error.message,
          statusCode: error.statusCode,
          url: req.url,
          method: req.method,
        });
      } else {
        serverError = getServerErrorFromUnknown(error);
      }

      // Don't report 400-499 errors to Sentry/console
      if (!(serverError.statusCode >= 400 && serverError.statusCode < 500)) {
        console.error(serverError);
        const { captureException } = await import("@sentry/nextjs");
        captureException(error);
      }

      return NextResponse.json(
        {
          message: serverError.message,
          url: serverError.url,
          method: serverError.method,
        },
        {
          status: serverError.statusCode,
        }
      );
    } finally {
      performance.mark("End");
      performance.measure(`[${ok ? "OK" : "ERROR"}][${req.method}] '${req.url}'`, "Start", "End");
    }
  };
};
