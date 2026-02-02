import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import {
  isTenantModeEnabled,
  resolveTenantById,
  resolveTenantFromHostname,
  resolveFromRequest,
  setDatabaseRouter,
  createHostnameRouter,
} from "./tenant";

// tenant.ts calls autoRegisterFromEnv() at import time, which reads process.env.TENANT_DOMAINS.
// We need to reset the module state between tests by re-importing after env changes.
// For tests that don't need re-import, we use setDatabaseRouter(null as any) to clear state.

describe("tenant resolver", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    // Clear any previously registered router
    setDatabaseRouter(null as unknown as Parameters<typeof setDatabaseRouter>[0]);
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("isTenantModeEnabled", () => {
    it("returns false when no router is registered", () => {
      expect(isTenantModeEnabled()).toBe(false);
    });

    it("returns true when a router is registered", () => {
      setDatabaseRouter({
        resolveFromRequest: () => null,
        resolveById: () => null,
      });
      expect(isTenantModeEnabled()).toBe(true);
    });
  });

  describe("setDatabaseRouter + resolveFromRequest", () => {
    it("uses the custom router for request resolution", () => {
      setDatabaseRouter({
        resolveFromRequest({ headers }) {
          const region = headers?.["x-region"] as string | undefined;
          if (region === "us") return { tenantId: "us", databaseUrl: "postgresql://us-db" };
          return null;
        },
        resolveById(id) {
          if (id === "us") return { tenantId: "us", databaseUrl: "postgresql://us-db" };
          return null;
        },
      });

      const result = resolveFromRequest({ headers: { "x-region": "us" } });
      expect(result).toEqual({ tenantId: "us", databaseUrl: "postgresql://us-db" });
    });

    it("returns null when custom router does not match", () => {
      setDatabaseRouter({
        resolveFromRequest: () => null,
        resolveById: () => null,
      });

      expect(resolveFromRequest({ hostname: "unknown.com" })).toBeNull();
    });

    it("returns null when no router is registered", () => {
      expect(resolveFromRequest({ hostname: "anything.com" })).toBeNull();
    });
  });

  describe("createHostnameRouter", () => {
    it("resolves tenant from matching hostname", () => {
      const router = createHostnameRouter({ "app.acme.com": "acme" });
      process.env.TENANT_ACME_DATABASE_URL = "postgresql://acme-db";

      const result = router.resolveFromRequest({ hostname: "app.acme.com" });
      expect(result).toEqual({ tenantId: "acme", databaseUrl: "postgresql://acme-db" });
    });

    it("strips port from hostname", () => {
      const router = createHostnameRouter({ "app.acme.com": "acme" });
      process.env.TENANT_ACME_DATABASE_URL = "postgresql://acme-db";

      const result = router.resolveFromRequest({ hostname: "app.acme.com:3000" });
      expect(result).toEqual({ tenantId: "acme", databaseUrl: "postgresql://acme-db" });
    });

    it("returns null for unknown hostname", () => {
      const router = createHostnameRouter({ "app.acme.com": "acme" });

      expect(router.resolveFromRequest({ hostname: "other.com" })).toBeNull();
    });

    it("returns null when hostname is undefined", () => {
      const router = createHostnameRouter({ "app.acme.com": "acme" });

      expect(router.resolveFromRequest({})).toBeNull();
    });

    it("returns null when database URL env var is missing", () => {
      const router = createHostnameRouter({ "app.acme.com": "acme" });
      // TENANT_ACME_DATABASE_URL not set

      expect(router.resolveFromRequest({ hostname: "app.acme.com" })).toBeNull();
    });

    it("resolves by ID", () => {
      const router = createHostnameRouter({ "app.acme.com": "acme" });
      process.env.TENANT_ACME_DATABASE_URL = "postgresql://acme-db";

      expect(router.resolveById("acme")).toEqual({
        tenantId: "acme",
        databaseUrl: "postgresql://acme-db",
      });
    });

    it("resolveById returns null when env var missing", () => {
      const router = createHostnameRouter({ "app.acme.com": "acme" });

      expect(router.resolveById("acme")).toBeNull();
    });

    it("converts tenant ID to uppercase for env var lookup", () => {
      const router = createHostnameRouter({ "app.test.com": "acme" });
      process.env.TENANT_ACME_DATABASE_URL = "postgresql://acme-db";

      expect(router.resolveById("acme")).toEqual({
        tenantId: "acme",
        databaseUrl: "postgresql://acme-db",
      });

      // Hyphens are preserved: "my-tenant" → TENANT_MY-TENANT_DATABASE_URL
      const router2 = createHostnameRouter({ "app.test.com": "my-tenant" });
      process.env["TENANT_MY-TENANT_DATABASE_URL"] = "postgresql://my-tenant-db";

      expect(router2.resolveById("my-tenant")).toEqual({
        tenantId: "my-tenant",
        databaseUrl: "postgresql://my-tenant-db",
      });
    });
  });

  describe("resolveTenantFromHostname (convenience wrapper)", () => {
    it("returns null when no router is registered", () => {
      expect(resolveTenantFromHostname("app.acme.com")).toBeNull();
    });

    it("returns null for null/undefined hostname", () => {
      setDatabaseRouter({
        resolveFromRequest: () => ({ tenantId: "x", databaseUrl: "postgresql://x" }),
        resolveById: () => null,
      });

      expect(resolveTenantFromHostname(null)).toBeNull();
      expect(resolveTenantFromHostname(undefined)).toBeNull();
    });

    it("delegates to the registered router", () => {
      setDatabaseRouter(createHostnameRouter({ "test.com": "test" }));
      process.env.TENANT_TEST_DATABASE_URL = "postgresql://test-db";

      expect(resolveTenantFromHostname("test.com")).toEqual({
        tenantId: "test",
        databaseUrl: "postgresql://test-db",
      });
    });
  });

  describe("resolveTenantById (convenience wrapper)", () => {
    it("returns null when no router is registered", () => {
      expect(resolveTenantById("acme")).toBeNull();
    });

    it("delegates to the registered router", () => {
      setDatabaseRouter(createHostnameRouter({ "app.acme.com": "acme" }));
      process.env.TENANT_ACME_DATABASE_URL = "postgresql://acme-db";

      expect(resolveTenantById("acme")).toEqual({
        tenantId: "acme",
        databaseUrl: "postgresql://acme-db",
      });
    });
  });
});
