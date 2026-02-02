/**
 * Pluggable database routing.
 *
 * By default, when `TENANT_DOMAINS` env var is set, the built-in hostname
 * resolver is auto-registered.  For custom routing (by region, header, etc.)
 * call `setDatabaseRouter()` at startup with your own resolver.
 *
 * Example – route by Cloudflare region header:
 *
 *   setDatabaseRouter({
 *     resolveFromRequest({ headers }) {
 *       const region = headers?.["cf-ipcountry"];
 *       if (region === "BR") return { tenantId: "br", databaseUrl: process.env.DB_BR_URL! };
 *       if (region === "US") return { tenantId: "us", databaseUrl: process.env.DB_US_URL! };
 *       return null;
 *     },
 *     resolveById(id) {
 *       const url = process.env[`DB_${id.toUpperCase()}_URL`];
 *       return url ? { tenantId: id, databaseUrl: url } : null;
 *     },
 *   });
 */

import process from "node:process";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TenantInfo = {
  tenantId: string;
  databaseUrl: string;
};

export type RouteContext = {
  hostname?: string;
  headers?: Record<string, string | string[] | undefined>;
};

export type DatabaseRouter = {
  /** Resolve from an incoming request. */
  resolveFromRequest(ctx: RouteContext): TenantInfo | null;
  /** Resolve by a known route ID (used by Trigger.dev metadata propagation). */
  resolveById(id: string): TenantInfo | null;
};

// ---------------------------------------------------------------------------
// Router state
// ---------------------------------------------------------------------------

let router: DatabaseRouter | null = null;

/** Register a custom database router. Call this once at startup. */
export function setDatabaseRouter(r: DatabaseRouter): void {
  router = r;
}

// ---------------------------------------------------------------------------
// Built-in hostname router (auto-registered when TENANT_DOMAINS is set)
// ---------------------------------------------------------------------------

export function createHostnameRouter(domainMap: Record<string, string>): DatabaseRouter {
  return {
    resolveFromRequest(ctx) {
      if (!ctx.hostname) return null;
      const host = ctx.hostname.split(":")[0];
      const tenantId = domainMap[host];
      if (!tenantId) return null;
      return this.resolveById(tenantId);
    },
    resolveById(id) {
      const envKey = `TENANT_${id.toUpperCase()}_DATABASE_URL`;
      const databaseUrl = process.env[envKey];
      if (!databaseUrl) return null;
      return { tenantId: id, databaseUrl };
    },
  };
}

function autoRegisterFromEnv(): void {
  const raw = process.env.TENANT_DOMAINS;
  if (!raw) return;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw new Error("TENANT_DOMAINS must be a JSON object mapping hostnames to tenant IDs");
    }
    if (Object.keys(parsed).length > 0) {
      router = createHostnameRouter(parsed as Record<string, string>);
    }
  } catch (err) {
    console.error("[database-router] Failed to parse TENANT_DOMAINS:", err);
  }
}

autoRegisterFromEnv();

// ---------------------------------------------------------------------------
// Public API (used by the rest of the codebase)
// ---------------------------------------------------------------------------

export function isTenantModeEnabled(): boolean {
  return router !== null;
}

export function resolveTenantById(tenantId: string): TenantInfo | null {
  if (!router) return null;
  return router.resolveById(tenantId);
}

export function resolveTenantFromHostname(hostname: string | undefined | null): TenantInfo | null {
  if (!router || !hostname) return null;
  return router.resolveFromRequest({ hostname });
}

/** Full resolution with all available request context (hostname + headers). */
export function resolveFromRequest(ctx: RouteContext): TenantInfo | null {
  if (!router) return null;
  return router.resolveFromRequest(ctx);
}
