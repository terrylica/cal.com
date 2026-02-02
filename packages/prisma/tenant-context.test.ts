import { describe, it, expect } from "vitest";

import { getCurrentTenant, runWithTenant } from "./tenant-context";

describe("tenant-context (AsyncLocalStorage)", () => {
  it("getCurrentTenant returns undefined outside runWithTenant", () => {
    expect(getCurrentTenant()).toBeUndefined();
  });

  it("getCurrentTenant returns the context inside runWithTenant", () => {
    const ctx = { tenantId: "acme", databaseUrl: "postgresql://acme-db" };

    runWithTenant(ctx, () => {
      expect(getCurrentTenant()).toEqual(ctx);
    });
  });

  it("context is cleaned up after runWithTenant completes", () => {
    const ctx = { tenantId: "acme", databaseUrl: "postgresql://acme-db" };

    runWithTenant(ctx, () => {
      // inside
    });

    expect(getCurrentTenant()).toBeUndefined();
  });

  it("supports nested contexts without leaking", () => {
    const outer = { tenantId: "outer", databaseUrl: "postgresql://outer-db" };
    const inner = { tenantId: "inner", databaseUrl: "postgresql://inner-db" };

    runWithTenant(outer, () => {
      expect(getCurrentTenant()).toEqual(outer);

      runWithTenant(inner, () => {
        expect(getCurrentTenant()).toEqual(inner);
      });

      // outer context restored after inner completes
      expect(getCurrentTenant()).toEqual(outer);
    });

    expect(getCurrentTenant()).toBeUndefined();
  });

  it("propagates context through async operations", async () => {
    const ctx = { tenantId: "async-test", databaseUrl: "postgresql://async-db" };

    await runWithTenant(ctx, async () => {
      // simulate async work
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(getCurrentTenant()).toEqual(ctx);
    });

    expect(getCurrentTenant()).toBeUndefined();
  });

  it("returns the value from the wrapped function", () => {
    const result = runWithTenant({ tenantId: "t", databaseUrl: "db" }, () => {
      return 42;
    });

    expect(result).toBe(42);
  });

  it("returns a promise from an async wrapped function", async () => {
    const result = await runWithTenant({ tenantId: "t", databaseUrl: "db" }, async () => {
      return "hello";
    });

    expect(result).toBe("hello");
  });
});
