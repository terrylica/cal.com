import { isTenantModeEnabled, resolveTenantFromHostname } from "@calcom/platform-libraries";
import { runWithTenant } from "@calcom/prisma/tenant-context";
import { Injectable, type NestMiddleware } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction): void {
    if (!isTenantModeEnabled()) {
      next();
      return;
    }

    const tenantInfo = resolveTenantFromHostname(req.hostname);
    if (!tenantInfo) {
      next();
      return;
    }

    runWithTenant(tenantInfo, () => next());
  }
}
