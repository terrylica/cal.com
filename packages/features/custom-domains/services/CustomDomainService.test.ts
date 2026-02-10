import { describe, it, expect, vi, beforeEach } from "vitest";

import type { CustomDomainRepository } from "../repositories/CustomDomainRepository";
import { CustomDomainService, DomainVerificationStatus } from "./CustomDomainService";

vi.mock("@calcom/lib/domainManager/deploymentServices/vercel", () => ({
  createDomain: vi.fn(),
  deleteDomain: vi.fn(),
  getDomain: vi.fn(),
  getConfig: vi.fn(),
  verifyDomain: vi.fn(),
}));

import {
  createDomain as createDomainOnVercel,
  deleteDomain as deleteDomainOnVercel,
  getDomain,
  getConfig,
  verifyDomain as verifyDomainOnVercel,
} from "@calcom/lib/domainManager/deploymentServices/vercel";

const mockDomainRecord = {
  id: "domain-1",
  teamId: 1,
  slug: "booking.acme.com",
  verified: false,
  lastCheckedAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
};

function createMockRepository() {
  return {
    findById: vi.fn(),
    findBySlug: vi.fn(),
    findBySlugWithTeam: vi.fn(),
    findByTeamId: vi.fn(),
    create: vi.fn(),
    updateVerificationStatus: vi.fn(),
    delete: vi.fn(),
    deleteByTeamId: vi.fn(),
    existsBySlug: vi.fn(),
    getUnverifiedDomainsForCheck: vi.fn(),
  } as unknown as CustomDomainRepository;
}

describe("CustomDomainService", () => {
  let service: CustomDomainService;
  let mockRepo: ReturnType<typeof createMockRepository>;

  beforeEach(() => {
    vi.resetAllMocks();
    mockRepo = createMockRepository();
    service = new CustomDomainService({ customDomainRepository: mockRepo });
  });

  describe("addDomain", () => {
    it("should create domain on Vercel and in DB for valid input", async () => {
      vi.mocked(mockRepo.findByTeamId).mockResolvedValue(null);
      vi.mocked(mockRepo.existsBySlug).mockResolvedValue(false);
      vi.mocked(createDomainOnVercel).mockResolvedValue(true);
      vi.mocked(mockRepo.create).mockResolvedValue(mockDomainRecord);

      const result = await service.addDomain({ teamId: 1, slug: "booking.acme.com" });

      expect(createDomainOnVercel).toHaveBeenCalledWith("booking.acme.com");
      expect(mockRepo.create).toHaveBeenCalledWith({ teamId: 1, slug: "booking.acme.com" });
      expect(result).toEqual(mockDomainRecord);
    });

    it("should normalize slug to lowercase and trimmed", async () => {
      vi.mocked(mockRepo.findByTeamId).mockResolvedValue(null);
      vi.mocked(mockRepo.existsBySlug).mockResolvedValue(false);
      vi.mocked(createDomainOnVercel).mockResolvedValue(true);
      vi.mocked(mockRepo.create).mockResolvedValue(mockDomainRecord);

      await service.addDomain({ teamId: 1, slug: "  Booking.ACME.COM  " });

      expect(createDomainOnVercel).toHaveBeenCalledWith("booking.acme.com");
      expect(mockRepo.create).toHaveBeenCalledWith({ teamId: 1, slug: "booking.acme.com" });
    });

    it("should throw BadRequest for invalid domain format (no dots)", async () => {
      await expect(service.addDomain({ teamId: 1, slug: "localhost" })).rejects.toThrow(
        "Invalid domain format"
      );
      expect(createDomainOnVercel).not.toHaveBeenCalled();
    });

    it("should throw BadRequest for invalid domain format (leading hyphen)", async () => {
      await expect(service.addDomain({ teamId: 1, slug: "-bad.com" })).rejects.toThrow(
        "Invalid domain format"
      );
    });

    it("should throw BadRequest for empty string", async () => {
      await expect(service.addDomain({ teamId: 1, slug: "" })).rejects.toThrow("Invalid domain format");
    });

    it("should throw BadRequest when team already has a custom domain", async () => {
      vi.mocked(mockRepo.findByTeamId).mockResolvedValue(mockDomainRecord);

      await expect(service.addDomain({ teamId: 1, slug: "booking.acme.com" })).rejects.toThrow(
        "Team already has a custom domain configured"
      );
      expect(createDomainOnVercel).not.toHaveBeenCalled();
    });

    it("should throw BadRequest when domain slug is already in use", async () => {
      vi.mocked(mockRepo.findByTeamId).mockResolvedValue(null);
      vi.mocked(mockRepo.existsBySlug).mockResolvedValue(true);

      await expect(service.addDomain({ teamId: 1, slug: "booking.acme.com" })).rejects.toThrow(
        "Domain is already in use"
      );
      expect(createDomainOnVercel).not.toHaveBeenCalled();
    });

    it("should accept valid multi-level domains", async () => {
      vi.mocked(mockRepo.findByTeamId).mockResolvedValue(null);
      vi.mocked(mockRepo.existsBySlug).mockResolvedValue(false);
      vi.mocked(createDomainOnVercel).mockResolvedValue(true);
      vi.mocked(mockRepo.create).mockResolvedValue(mockDomainRecord);

      await service.addDomain({ teamId: 1, slug: "sub.domain.co.uk" });

      expect(createDomainOnVercel).toHaveBeenCalledWith("sub.domain.co.uk");
    });
  });

  describe("removeDomain", () => {
    it("should delete domain from Vercel and DB", async () => {
      vi.mocked(mockRepo.findByTeamId).mockResolvedValue(mockDomainRecord);
      vi.mocked(deleteDomainOnVercel).mockResolvedValue(true);
      vi.mocked(mockRepo.delete).mockResolvedValue(mockDomainRecord);

      const result = await service.removeDomain({ teamId: 1 });

      expect(deleteDomainOnVercel).toHaveBeenCalledWith("booking.acme.com");
      expect(mockRepo.delete).toHaveBeenCalledWith("domain-1");
      expect(result).toEqual({ success: true });
    });

    it("should throw NotFound when team has no custom domain", async () => {
      vi.mocked(mockRepo.findByTeamId).mockResolvedValue(null);

      await expect(service.removeDomain({ teamId: 1 })).rejects.toThrow(
        "No custom domain found for this team"
      );
      expect(deleteDomainOnVercel).not.toHaveBeenCalled();
    });
  });

  describe("getDomain", () => {
    it("should return domain record for team", async () => {
      vi.mocked(mockRepo.findByTeamId).mockResolvedValue(mockDomainRecord);

      const result = await service.getDomain(1);
      expect(result).toEqual(mockDomainRecord);
    });

    it("should return null when team has no domain", async () => {
      vi.mocked(mockRepo.findByTeamId).mockResolvedValue(null);

      const result = await service.getDomain(1);
      expect(result).toBeNull();
    });
  });

  describe("verifyDomainStatus", () => {
    it("should return NOT_FOUND when team has no domain record", async () => {
      vi.mocked(mockRepo.findByTeamId).mockResolvedValue(null);

      const result = await service.verifyDomainStatus(1);
      expect(result).toEqual({ status: DomainVerificationStatus.NOT_FOUND, domain: null });
    });

    it("should return VALID when Vercel domain is verified and config is OK", async () => {
      vi.mocked(mockRepo.findByTeamId).mockResolvedValue({ ...mockDomainRecord, verified: false });
      vi.mocked(getDomain).mockResolvedValue({
        name: "booking.acme.com",
        apexName: "acme.com",
        verified: true,
      });
      vi.mocked(getConfig).mockResolvedValue({ misconfigured: false });

      const result = await service.verifyDomainStatus(1);

      expect(result.status).toBe(DomainVerificationStatus.VALID);
      expect(result.domain).toBe("booking.acme.com");
      expect(mockRepo.updateVerificationStatus).toHaveBeenCalledWith("domain-1", true);
    });

    it("should return PENDING when Vercel domain not yet verified and verify attempt fails", async () => {
      vi.mocked(mockRepo.findByTeamId).mockResolvedValue(mockDomainRecord);
      vi.mocked(getDomain).mockResolvedValue({
        name: "booking.acme.com",
        apexName: "acme.com",
        verified: false,
      });
      vi.mocked(getConfig).mockResolvedValue({ misconfigured: false });
      vi.mocked(verifyDomainOnVercel).mockResolvedValue({
        name: "booking.acme.com",
        apexName: "acme.com",
        verified: false,
        verification: [{ type: "TXT", domain: "_vercel.booking.acme.com", value: "abc", reason: "pending" }],
      });

      const result = await service.verifyDomainStatus(1);

      expect(result.status).toBe(DomainVerificationStatus.PENDING);
      expect(result.domain).toBe("booking.acme.com");
    });

    it("should return VALID when verify attempt succeeds", async () => {
      vi.mocked(mockRepo.findByTeamId).mockResolvedValue(mockDomainRecord);
      vi.mocked(getDomain).mockResolvedValue({
        name: "booking.acme.com",
        apexName: "acme.com",
        verified: false,
      });
      vi.mocked(getConfig).mockResolvedValue({ misconfigured: false });
      vi.mocked(verifyDomainOnVercel).mockResolvedValue({
        name: "booking.acme.com",
        apexName: "acme.com",
        verified: true,
      });

      const result = await service.verifyDomainStatus(1);

      expect(result.status).toBe(DomainVerificationStatus.VALID);
    });

    it("should return CONFLICTING_DNS when config has conflicts", async () => {
      vi.mocked(mockRepo.findByTeamId).mockResolvedValue(mockDomainRecord);
      vi.mocked(getDomain).mockResolvedValue({
        name: "booking.acme.com",
        apexName: "acme.com",
        verified: true,
      });
      vi.mocked(getConfig).mockResolvedValue({
        misconfigured: false,
        conflicts: [{ name: "booking.acme.com", type: "A", value: "1.2.3.4" }],
      });

      const result = await service.verifyDomainStatus(1);

      expect(result.status).toBe(DomainVerificationStatus.CONFLICTING_DNS);
    });

    it("should return INVALID_CONFIGURATION when verified but misconfigured", async () => {
      vi.mocked(mockRepo.findByTeamId).mockResolvedValue(mockDomainRecord);
      vi.mocked(getDomain).mockResolvedValue({
        name: "booking.acme.com",
        apexName: "acme.com",
        verified: true,
      });
      vi.mocked(getConfig).mockResolvedValue({ misconfigured: true });

      const result = await service.verifyDomainStatus(1);

      expect(result.status).toBe(DomainVerificationStatus.INVALID_CONFIGURATION);
    });

    it("should return NOT_FOUND when Vercel returns not_found error", async () => {
      vi.mocked(mockRepo.findByTeamId).mockResolvedValue(mockDomainRecord);
      vi.mocked(getDomain).mockResolvedValue({
        name: "booking.acme.com",
        apexName: "acme.com",
        verified: false,
        error: { code: "not_found", message: "Domain not found" },
      });
      vi.mocked(getConfig).mockResolvedValue({ misconfigured: false });

      const result = await service.verifyDomainStatus(1);

      expect(result.status).toBe(DomainVerificationStatus.NOT_FOUND);
    });

    it("should return UNKNOWN_ERROR for other Vercel errors", async () => {
      vi.mocked(mockRepo.findByTeamId).mockResolvedValue(mockDomainRecord);
      vi.mocked(getDomain).mockResolvedValue({
        name: "booking.acme.com",
        apexName: "acme.com",
        verified: false,
        error: { code: "server_error", message: "Internal error" },
      });
      vi.mocked(getConfig).mockResolvedValue({ misconfigured: false });

      const result = await service.verifyDomainStatus(1);

      expect(result.status).toBe(DomainVerificationStatus.UNKNOWN_ERROR);
    });

    it("should not call updateVerificationStatus when status hasn't changed", async () => {
      vi.mocked(mockRepo.findByTeamId).mockResolvedValue({ ...mockDomainRecord, verified: true });
      vi.mocked(getDomain).mockResolvedValue({
        name: "booking.acme.com",
        apexName: "acme.com",
        verified: true,
      });
      vi.mocked(getConfig).mockResolvedValue({ misconfigured: false });

      await service.verifyDomainStatus(1);

      expect(mockRepo.updateVerificationStatus).not.toHaveBeenCalled();
    });

    it("should update verified to false when previously verified but now pending", async () => {
      vi.mocked(mockRepo.findByTeamId).mockResolvedValue({ ...mockDomainRecord, verified: true });
      vi.mocked(getDomain).mockResolvedValue({
        name: "booking.acme.com",
        apexName: "acme.com",
        verified: false,
      });
      vi.mocked(getConfig).mockResolvedValue({ misconfigured: false });
      vi.mocked(verifyDomainOnVercel).mockResolvedValue({
        name: "booking.acme.com",
        apexName: "acme.com",
        verified: false,
      });

      await service.verifyDomainStatus(1);

      expect(mockRepo.updateVerificationStatus).toHaveBeenCalledWith("domain-1", false);
    });
  });
});
