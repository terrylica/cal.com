import type { Request } from "express";

jest.mock("@/env", () => ({
  getEnv: jest.fn((key: string, fallback?: string) => {
    const value = process.env[key];
    if (value === undefined) {
      if (fallback !== undefined) {
        return fallback;
      }
      throw new Error(`Missing environment variable: ${key}.`);
    }
    return value;
  }),
}));

import { getEffectiveHost, getTrustedForwardedHosts } from "./get-effective-host";

describe("getTrustedForwardedHosts", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns empty array when API_TRUSTED_FORWARDED_HOSTS is not set", () => {
    delete process.env.API_TRUSTED_FORWARDED_HOSTS;
    const result = getTrustedForwardedHosts();
    expect(result).toEqual([]);
  });

  it("returns empty array when API_TRUSTED_FORWARDED_HOSTS is empty string", () => {
    process.env.API_TRUSTED_FORWARDED_HOSTS = "";
    const result = getTrustedForwardedHosts();
    expect(result).toEqual([]);
  });

  it("returns single host when API_TRUSTED_FORWARDED_HOSTS has one value", () => {
    process.env.API_TRUSTED_FORWARDED_HOSTS = "api.cal.com";
    const result = getTrustedForwardedHosts();
    expect(result).toEqual(["api.cal.com"]);
  });

  it("returns multiple hosts when API_TRUSTED_FORWARDED_HOSTS has comma-separated values", () => {
    process.env.API_TRUSTED_FORWARDED_HOSTS = "api.cal.com,api.staging.cal.com";
    const result = getTrustedForwardedHosts();
    expect(result).toEqual(["api.cal.com", "api.staging.cal.com"]);
  });

  it("trims whitespace from hosts", () => {
    process.env.API_TRUSTED_FORWARDED_HOSTS = " api.cal.com , api.staging.cal.com ";
    const result = getTrustedForwardedHosts();
    expect(result).toEqual(["api.cal.com", "api.staging.cal.com"]);
  });

  it("converts hosts to lowercase", () => {
    process.env.API_TRUSTED_FORWARDED_HOSTS = "API.CAL.COM,Api.Staging.Cal.Com";
    const result = getTrustedForwardedHosts();
    expect(result).toEqual(["api.cal.com", "api.staging.cal.com"]);
  });

  it("filters out empty entries", () => {
    process.env.API_TRUSTED_FORWARDED_HOSTS = "api.cal.com,,api.staging.cal.com,";
    const result = getTrustedForwardedHosts();
    expect(result).toEqual(["api.cal.com", "api.staging.cal.com"]);
  });
});

describe("getEffectiveHost", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  function createMockRequest(headers: Record<string, string | string[] | undefined>): Request {
    return {
      headers,
    } as unknown as Request;
  }

  it("returns Host header when X-Forwarded-Host is not present", () => {
    process.env.API_TRUSTED_FORWARDED_HOSTS = "api.cal.com";
    const request = createMockRequest({
      host: "cal-api-v2.vercel.app",
    });
    const result = getEffectiveHost(request);
    expect(result).toBe("cal-api-v2.vercel.app");
  });

  it("returns Host header when no trusted hosts are configured", () => {
    delete process.env.API_TRUSTED_FORWARDED_HOSTS;
    const request = createMockRequest({
      host: "cal-api-v2.vercel.app",
      "x-forwarded-host": "api.cal.com",
    });
    const result = getEffectiveHost(request);
    expect(result).toBe("cal-api-v2.vercel.app");
  });

  it("returns X-Forwarded-Host when it matches a trusted host", () => {
    process.env.API_TRUSTED_FORWARDED_HOSTS = "api.cal.com";
    const request = createMockRequest({
      host: "cal-api-v2.vercel.app",
      "x-forwarded-host": "api.cal.com",
    });
    const result = getEffectiveHost(request);
    expect(result).toBe("api.cal.com");
  });

  it("returns Host header when X-Forwarded-Host does not match trusted hosts", () => {
    process.env.API_TRUSTED_FORWARDED_HOSTS = "api.cal.com";
    const request = createMockRequest({
      host: "cal-api-v2.vercel.app",
      "x-forwarded-host": "malicious.com",
    });
    const result = getEffectiveHost(request);
    expect(result).toBe("cal-api-v2.vercel.app");
  });

  it("handles X-Forwarded-Host with multiple values (comma-separated)", () => {
    process.env.API_TRUSTED_FORWARDED_HOSTS = "api.cal.com";
    const request = createMockRequest({
      host: "cal-api-v2.vercel.app",
      "x-forwarded-host": "api.cal.com, proxy.example.com",
    });
    const result = getEffectiveHost(request);
    expect(result).toBe("api.cal.com");
  });

  it("handles X-Forwarded-Host as array", () => {
    process.env.API_TRUSTED_FORWARDED_HOSTS = "api.cal.com";
    const request = createMockRequest({
      host: "cal-api-v2.vercel.app",
      "x-forwarded-host": ["api.cal.com", "proxy.example.com"],
    });
    const result = getEffectiveHost(request);
    expect(result).toBe("api.cal.com");
  });

  it("is case-insensitive when matching trusted hosts", () => {
    process.env.API_TRUSTED_FORWARDED_HOSTS = "api.cal.com";
    const request = createMockRequest({
      host: "cal-api-v2.vercel.app",
      "x-forwarded-host": "API.CAL.COM",
    });
    const result = getEffectiveHost(request);
    expect(result).toBe("api.cal.com");
  });

  it("returns empty string when no Host header is present", () => {
    delete process.env.API_TRUSTED_FORWARDED_HOSTS;
    const request = createMockRequest({});
    const result = getEffectiveHost(request);
    expect(result).toBe("");
  });

  it("works with multiple trusted hosts", () => {
    process.env.API_TRUSTED_FORWARDED_HOSTS = "api.cal.com,api.staging.cal.com";
    const request = createMockRequest({
      host: "cal-api-v2.vercel.app",
      "x-forwarded-host": "api.staging.cal.com",
    });
    const result = getEffectiveHost(request);
    expect(result).toBe("api.staging.cal.com");
  });
});
