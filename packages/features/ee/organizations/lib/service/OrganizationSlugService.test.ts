import { beforeEach, describe, expect, it, vi } from "vitest";
import { OrganizationSlugService } from "./OrganizationSlugService";

vi.mock("@calcom/features/watchlist/lib/freeEmailDomainCheck/checkIfFreeEmailDomain", () => ({
  checkIfFreeEmailDomain: vi.fn(),
}));

import { checkIfFreeEmailDomain } from "@calcom/features/watchlist/lib/freeEmailDomainCheck/checkIfFreeEmailDomain";

const mockCheckIfFreeEmailDomain = vi.mocked(checkIfFreeEmailDomain);

describe("OrganizationSlugService", () => {
  let service: OrganizationSlugService;

  beforeEach(() => {
    service = new OrganizationSlugService();
    vi.clearAllMocks();
  });

  describe("isProtectedSlug", () => {
    it("should return true for Fortune 500 slugs", () => {
      expect(service.isProtectedSlug("google")).toBe(true);
      expect(service.isProtectedSlug("apple")).toBe(true);
      expect(service.isProtectedSlug("microsoft")).toBe(true);
      expect(service.isProtectedSlug("amazon")).toBe(true);
      expect(service.isProtectedSlug("tesla")).toBe(true);
    });

    it("should be case-insensitive", () => {
      expect(service.isProtectedSlug("Google")).toBe(true);
      expect(service.isProtectedSlug("APPLE")).toBe(true);
      expect(service.isProtectedSlug("Microsoft")).toBe(true);
    });

    it("should return false for non-protected slugs", () => {
      expect(service.isProtectedSlug("my-consulting-biz")).toBe(false);
      expect(service.isProtectedSlug("acme")).toBe(false);
      expect(service.isProtectedSlug("cool-startup")).toBe(false);
    });
  });

  describe("isOwnerEmailFreeEmailDomain", () => {
    it("should delegate to checkIfFreeEmailDomain", async () => {
      mockCheckIfFreeEmailDomain.mockResolvedValue(true);
      const result = await service.isOwnerEmailFreeEmailDomain("john@gmail.com");
      expect(result).toBe(true);
      expect(mockCheckIfFreeEmailDomain).toHaveBeenCalledWith({ email: "john@gmail.com" });
    });

    it("should return false for company emails", async () => {
      mockCheckIfFreeEmailDomain.mockResolvedValue(false);
      const result = await service.isOwnerEmailFreeEmailDomain("sean@acme.com");
      expect(result).toBe(false);
    });
  });

  describe("validateSlugForOrgCreation", () => {
    it("should allow non-protected slugs for free email users", async () => {
      mockCheckIfFreeEmailDomain.mockResolvedValue(true);
      const result = await service.validateSlugForOrgCreation({
        slug: "my-consulting-biz",
        ownerEmail: "john@gmail.com",
      });
      expect(result).toEqual({ allowed: true });
    });

    it("should allow non-protected slugs for company email users", async () => {
      mockCheckIfFreeEmailDomain.mockResolvedValue(false);
      const result = await service.validateSlugForOrgCreation({
        slug: "acme",
        ownerEmail: "sean@acme.com",
      });
      expect(result).toEqual({ allowed: true });
    });

    it("should block protected slugs for free email users", async () => {
      mockCheckIfFreeEmailDomain.mockResolvedValue(true);
      const result = await service.validateSlugForOrgCreation({
        slug: "google",
        ownerEmail: "john@gmail.com",
      });
      expect(result).toEqual({
        allowed: false,
        reason: "protected_slug_requires_company_email",
      });
    });

    it("should block protected slugs when company email domain does not match", async () => {
      mockCheckIfFreeEmailDomain.mockResolvedValue(false);
      const result = await service.validateSlugForOrgCreation({
        slug: "google",
        ownerEmail: "sean@acme.com",
      });
      expect(result).toEqual({
        allowed: false,
        reason: "protected_slug_requires_matching_domain",
      });
    });

    it("should allow protected slugs when company email domain matches", async () => {
      mockCheckIfFreeEmailDomain.mockResolvedValue(false);
      const result = await service.validateSlugForOrgCreation({
        slug: "google",
        ownerEmail: "admin@google.com",
      });
      expect(result).toEqual({ allowed: true });
    });

    it("should handle slug case insensitively", async () => {
      mockCheckIfFreeEmailDomain.mockResolvedValue(true);
      const result = await service.validateSlugForOrgCreation({
        slug: "Google",
        ownerEmail: "john@gmail.com",
      });
      expect(result).toEqual({
        allowed: false,
        reason: "protected_slug_requires_company_email",
      });
    });
  });
});
