import { describe, expect, it } from "vitest";

import {
  getOrgSlug,
  getOrgDomainConfigFromHostname,
  getOrgFullOrigin,
  whereClauseForOrgWithSlugOrRequestedSlug,
  getSlugOrRequestedSlug,
} from "@calcom/features/ee/organizations/lib/orgDomains";
import * as constants from "@calcom/lib/constants";

function setupEnvs({ WEBAPP_URL = "https://app.cal.com", WEBSITE_URL = "https://cal.com" } = {}) {
  Object.defineProperty(constants, "WEBAPP_URL", { value: WEBAPP_URL });
  Object.defineProperty(constants, "WEBSITE_URL", { value: WEBSITE_URL });
  Object.defineProperty(constants, "ALLOWED_HOSTNAMES", {
    value: ["cal.com", "cal.dev", "cal-staging.com", "cal.community", "cal.local:3000", "localhost:3000"],
  });
  Object.defineProperty(constants, "RESERVED_SUBDOMAINS", {
    value: [
      "app",
      "auth",
      "docs",
      "design",
      "console",
      "go",
      "status",
      "api",
      "saml",
      "www",
      "matrix",
      "developer",
      "cal",
      "my",
      "team",
      "support",
      "security",
      "blog",
      "learn",
      "admin",
    ],
  });
}

describe("Org Domains Utils", () => {
  describe("getOrgDomainConfigFromHostname", () => {
    it("should return a valid org domain", () => {
      setupEnvs();
      expect(getOrgDomainConfigFromHostname({ hostname: "acme.cal.com" })).toEqual({
        currentOrgDomain: "acme",
        isValidOrgDomain: true,
        customDomain: null,
      });
    });

    it("should return a non valid org domain", () => {
      setupEnvs();
      expect(getOrgDomainConfigFromHostname({ hostname: "app.cal.com" })).toEqual({
        currentOrgDomain: null,
        isValidOrgDomain: false,
        customDomain: null,
      });
    });

    it("should return a non valid org domain for localhost", () => {
      setupEnvs();
      expect(getOrgDomainConfigFromHostname({ hostname: "localhost:3000" })).toEqual({
        currentOrgDomain: null,
        isValidOrgDomain: false,
        customDomain: null,
      });
    });

    it("should detect a custom domain hostname not matching any allowed hostnames", () => {
      setupEnvs();
      expect(getOrgDomainConfigFromHostname({ hostname: "booking.acme.com" })).toEqual({
        currentOrgDomain: "booking.acme.com",
        isValidOrgDomain: true,
        customDomain: "booking.acme.com",
      });
    });

    it("should strip port from custom domain hostname", () => {
      setupEnvs();
      const result = getOrgDomainConfigFromHostname({ hostname: "booking.acme.com:3000" });
      expect(result.customDomain).toEqual("booking.acme.com");
      expect(result.currentOrgDomain).toEqual("booking.acme.com");
      expect(result.isValidOrgDomain).toBe(true);
    });

    it("should prioritize valid org subdomain over custom domain detection", () => {
      setupEnvs();
      const result = getOrgDomainConfigFromHostname({ hostname: "acme.cal.com" });
      expect(result.customDomain).toBeNull();
      expect(result.currentOrgDomain).toEqual("acme");
    });
  });

  describe("getOrgSlug", () => {
    it("should handle a prod web app url with a prod subdomain hostname", () => {
      setupEnvs();
      expect(getOrgSlug("acme.cal.com")).toEqual("acme");
    });

    it("should handle a prod web app url with a staging subdomain hostname", () => {
      setupEnvs();
      expect(getOrgSlug("acme.cal.dev")).toEqual(null);
    });

    it("should handle a local web app with port url with a local subdomain hostname", () => {
      setupEnvs({ WEBAPP_URL: "http://app.cal.local:3000" });
      expect(getOrgSlug("acme.cal.local:3000")).toEqual("acme");
    });

    it("should handle a local web app with port url with a non-local subdomain hostname", () => {
      setupEnvs({ WEBAPP_URL: "http://app.cal.local:3000" });
      expect(getOrgSlug("acme.cal.com:3000")).toEqual(null);
    });
  });

  describe("getOrgFullOrigin", () => {
    it("should return WEBSITE_URL when slug is null and domains match", () => {
      setupEnvs({
        WEBAPP_URL: "https://app.cal.com",
        WEBSITE_URL: "https://cal.com",
      });
      expect(getOrgFullOrigin(null)).toEqual("https://cal.com");
    });
    it("should return WEBAPP_URL when slug is null and domains differ (EU case)", () => {
      setupEnvs({
        WEBAPP_URL: "https://app.cal.eu",
        WEBSITE_URL: "https://cal.com",
      });
      expect(getOrgFullOrigin(null)).toEqual("https://app.cal.eu");
    });
    it("should return the org origin if slug is set", () => {
      setupEnvs({
        WEBAPP_URL: "https://app.cal-app.com",
        WEBSITE_URL: "https://cal.com",
      });
      // We are supposed to use WEBAPP_URL to derive the origin from and not WEBSITE_URL
      expect(getOrgFullOrigin("org")).toEqual("https://org.cal-app.com");
    });

    describe("custom domain mode (isCustomDomain: true)", () => {
      it("should return custom domain without port in production", () => {
        setupEnvs({
          WEBAPP_URL: "https://app.cal.com",
          WEBSITE_URL: "https://cal.com",
        });
        Object.defineProperty(constants, "IS_PRODUCTION", { value: true });
        expect(getOrgFullOrigin("booking.acme.com", { isCustomDomain: true })).toEqual(
          "https://booking.acme.com"
        );
      });

      it("should return custom domain with port in dev", () => {
        setupEnvs({
          WEBAPP_URL: "http://app.cal.local:3000",
          WEBSITE_URL: "http://cal.local:3000",
        });
        Object.defineProperty(constants, "IS_PRODUCTION", { value: false });
        expect(getOrgFullOrigin("booking.acme.com", { isCustomDomain: true })).toEqual(
          "http://booking.acme.com:3000"
        );
      });

      it("should strip protocol when protocol option is false", () => {
        setupEnvs({
          WEBAPP_URL: "https://app.cal.com",
          WEBSITE_URL: "https://cal.com",
        });
        Object.defineProperty(constants, "IS_PRODUCTION", { value: true });
        expect(getOrgFullOrigin("booking.acme.com", { isCustomDomain: true, protocol: false })).toEqual(
          "booking.acme.com"
        );
      });

      it("should not append subdomain suffix to custom domain", () => {
        setupEnvs({
          WEBAPP_URL: "https://app.cal-app.com",
          WEBSITE_URL: "https://cal.com",
        });
        Object.defineProperty(constants, "IS_PRODUCTION", { value: true });
        const result = getOrgFullOrigin("booking.acme.com", { isCustomDomain: true });
        expect(result).toEqual("https://booking.acme.com");
        expect(result).not.toContain("cal-app.com");
      });
    });
  });

  describe("whereClauseForOrgWithSlugOrRequestedSlug", () => {
    it("should include customDomain lookup in OR clause", () => {
      const result = whereClauseForOrgWithSlugOrRequestedSlug("acme");
      expect(result.isOrganization).toBe(true);
      expect(result.OR).toBeDefined();
      const orClause = result.OR as Array<Record<string, unknown>>;
      expect(orClause).toHaveLength(3);
      expect(orClause[2]).toEqual({
        customDomain: { slug: "acme", verified: true },
      });
    });

    it("should pass raw identifier to customDomain slug", () => {
      const result = whereClauseForOrgWithSlugOrRequestedSlug("booking.acme.com");
      const orClause = result.OR as Array<Record<string, unknown>>;
      expect(orClause[2]).toEqual({
        customDomain: { slug: "booking.acme.com", verified: true },
      });
    });
  });

  describe("getSlugOrRequestedSlug", () => {
    it("should include customDomain lookup without isOrganization filter", () => {
      const result = getSlugOrRequestedSlug("booking.acme.com");
      expect(result).not.toHaveProperty("isOrganization");
      const orClause = result.OR as Array<Record<string, unknown>>;
      expect(orClause).toHaveLength(3);
      expect(orClause[2]).toEqual({
        customDomain: { slug: "booking.acme.com", verified: true },
      });
    });
  });
});
