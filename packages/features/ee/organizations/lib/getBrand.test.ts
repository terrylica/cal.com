import { prisma } from "@calcom/prisma";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getBrand } from "./getBrand";

vi.mock("@calcom/prisma", () => ({
  prisma: {
    team: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@calcom/features/ee/organizations/lib/orgDomains", () => ({
  getOrgFullOrigin: vi.fn().mockReturnValue("https://mocked-origin.com"),
  subdomainSuffix: vi.fn().mockReturnValue("cal.com"),
}));

import { getOrgFullOrigin, subdomainSuffix } from "@calcom/features/ee/organizations/lib/orgDomains";

describe("getBrand", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(subdomainSuffix).mockReturnValue("cal.com");
    vi.mocked(getOrgFullOrigin).mockReturnValue("https://mocked-origin.com");
  });

  it("should return null for null orgId", async () => {
    const result = await getBrand(null);
    expect(result).toBeNull();
    expect(prisma.team.findUnique).not.toHaveBeenCalled();
  });

  it("should return null when org is not found", async () => {
    vi.mocked(prisma.team.findUnique).mockResolvedValue(null);

    const result = await getBrand(999);
    expect(result).toBeNull();
  });

  it("should return null for platform org", async () => {
    vi.mocked(prisma.team.findUnique).mockResolvedValue({
      slug: "platform-org",
      name: "Platform Org",
      logoUrl: null,
      metadata: null,
      isPlatform: true,
      customDomain: null,
    });

    const result = await getBrand(1);
    expect(result).toBeNull();
    expect(getOrgFullOrigin).not.toHaveBeenCalled();
  });

  it("should use org slug when no customDomain is present", async () => {
    vi.mocked(prisma.team.findUnique).mockResolvedValue({
      slug: "acme",
      name: "Acme Corp",
      logoUrl: null,
      metadata: null,
      isPlatform: false,
      customDomain: null,
    });
    vi.mocked(getOrgFullOrigin).mockReturnValue("https://acme.cal.com");

    const result = await getBrand(1);

    expect(getOrgFullOrigin).toHaveBeenCalledWith("acme", {
      protocol: true,
      isCustomDomain: false,
    });
    expect(result?.fullDomain).toBe("https://acme.cal.com");
    expect(result?.slug).toBe("acme");
  });

  it("should use customDomain when present", async () => {
    vi.mocked(prisma.team.findUnique).mockResolvedValue({
      slug: "acme",
      name: "Acme Corp",
      logoUrl: null,
      metadata: null,
      isPlatform: false,
      customDomain: { slug: "booking.acme.com" },
    });
    vi.mocked(getOrgFullOrigin).mockReturnValue("https://booking.acme.com");

    const result = await getBrand(1);

    expect(getOrgFullOrigin).toHaveBeenCalledWith("booking.acme.com", {
      protocol: true,
      isCustomDomain: true,
    });
    expect(result?.fullDomain).toBe("https://booking.acme.com");
  });

  it("should use requestedSlug fallback when slug is null and no customDomain", async () => {
    vi.mocked(prisma.team.findUnique).mockResolvedValue({
      slug: null,
      name: "Pending Org",
      logoUrl: null,
      metadata: { requestedSlug: "pending-org" },
      isPlatform: false,
      customDomain: null,
    });
    vi.mocked(getOrgFullOrigin).mockReturnValue("https://pending-org.cal.com");

    const result = await getBrand(1);

    expect(getOrgFullOrigin).toHaveBeenCalledWith("pending-org", {
      protocol: true,
      isCustomDomain: false,
    });
    expect(result?.slug).toBe("pending-org");
  });
});
