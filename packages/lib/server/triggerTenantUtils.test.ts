import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import { getCurrentTenant, runWithTenant } from "@calcom/prisma/tenant-context";

import { tenantTriggerOptions, withTenantRun } from "./triggerTenantUtils";
import { setDatabaseRouter, createHostnameRouter } from "./tenant";

describe("triggerTenantUtils", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    setDatabaseRouter(null as unknown as Parameters<typeof setDatabaseRouter>[0]);
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("tenantTriggerOptions", () => {
    it("returns undefined when not inside a tenant context", () => {
      expect(tenantTriggerOptions()).toBeUndefined();
    });

    it("returns metadata with tenantId when inside a tenant context", () => {
      const ctx = { tenantId: "acme", databaseUrl: "postgresql://acme-db" };

      runWithTenant(ctx, () => {
        const options = tenantTriggerOptions();
        expect(options).toEqual({
          metadata: { tenantId: "acme" },
        });
      });
    });
  });

  describe("withTenantRun", () => {
    it("calls the function directly when tenant mode is disabled", async () => {
      const fn = vi.fn().mockResolvedValue("result");
      const wrapped = withTenantRun(fn);

      const result = await wrapped("arg1", "arg2");

      expect(result).toBe("result");
      expect(fn).toHaveBeenCalledWith("arg1", "arg2");
    });

    it("calls the function directly when tenant mode is enabled but no metadata", async () => {
      setDatabaseRouter(createHostnameRouter({ "test.com": "test" }));

      // Mock the metadata import to return no tenantId
      vi.mock("@trigger.dev/sdk", () => ({
        metadata: {
          get: vi.fn().mockReturnValue(undefined),
        },
      }));

      const fn = vi.fn().mockResolvedValue("result");
      const wrapped = withTenantRun(fn);

      const result = await wrapped("payload");

      expect(result).toBe("result");
      expect(fn).toHaveBeenCalledWith("payload");
    });

    it("wraps with runWithTenant when tenant mode is enabled and metadata has tenantId", async () => {
      setDatabaseRouter(createHostnameRouter({ "test.com": "test" }));
      process.env.TENANT_TEST_DATABASE_URL = "postgresql://test-db";

      vi.mock("@trigger.dev/sdk", () => ({
        metadata: {
          get: vi.fn().mockReturnValue("test"),
        },
      }));

      let capturedTenant: ReturnType<typeof getCurrentTenant> | undefined;
      const fn = vi.fn().mockImplementation(async () => {
        capturedTenant = getCurrentTenant();
        return "done";
      });

      const wrapped = withTenantRun(fn);
      const result = await wrapped("payload");

      expect(result).toBe("done");
      expect(capturedTenant).toEqual({
        tenantId: "test",
        databaseUrl: "postgresql://test-db",
      });
    });

    it("passes all arguments through to the wrapped function", async () => {
      const fn = vi.fn().mockResolvedValue(undefined);
      const wrapped = withTenantRun(fn);

      await wrapped("arg1", { key: "value" }, 42);

      expect(fn).toHaveBeenCalledWith("arg1", { key: "value" }, 42);
    });
  });
});
