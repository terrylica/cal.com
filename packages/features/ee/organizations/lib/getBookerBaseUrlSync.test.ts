import { describe, it, vi, expect, beforeEach } from "vitest";

import * as orgDomainsExport from "@calcom/ee/organizations/lib/orgDomains";

import { getBookerBaseUrlSync } from "./getBookerBaseUrlSync";

vi.mock("@calcom/ee/organizations/lib/orgDomains", () => ({
  getOrgFullOrigin: vi.fn(),
}));

describe("getBookerBaseUrlSync", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("should call getOrgFullOrigin with customDomain and isCustomDomain=true when customDomain is provided", () => {
    vi.mocked(orgDomainsExport.getOrgFullOrigin).mockReturnValue("https://booking.acme.com");

    const result = getBookerBaseUrlSync("acme", { customDomain: "booking.acme.com" });

    expect(orgDomainsExport.getOrgFullOrigin).toHaveBeenCalledWith("booking.acme.com", {
      isCustomDomain: true,
    });
    expect(result).toBe("https://booking.acme.com");
  });

  it("should call getOrgFullOrigin with orgSlug when customDomain is not provided", () => {
    vi.mocked(orgDomainsExport.getOrgFullOrigin).mockReturnValue("https://acme.cal.com");

    const result = getBookerBaseUrlSync("acme");

    expect(orgDomainsExport.getOrgFullOrigin).toHaveBeenCalledWith("acme", {});
    expect(result).toBe("https://acme.cal.com");
  });

  it("should call getOrgFullOrigin with orgSlug when customDomain is null", () => {
    vi.mocked(orgDomainsExport.getOrgFullOrigin).mockReturnValue("https://acme.cal.com");

    getBookerBaseUrlSync("acme", { customDomain: null });

    expect(orgDomainsExport.getOrgFullOrigin).toHaveBeenCalledWith("acme", {});
  });

  it("should call getOrgFullOrigin with empty string when orgSlug is null and no customDomain", () => {
    vi.mocked(orgDomainsExport.getOrgFullOrigin).mockReturnValue("https://cal.com");

    getBookerBaseUrlSync(null);

    expect(orgDomainsExport.getOrgFullOrigin).toHaveBeenCalledWith("", {});
  });

  it("should forward protocol option with customDomain", () => {
    vi.mocked(orgDomainsExport.getOrgFullOrigin).mockReturnValue("booking.acme.com");

    getBookerBaseUrlSync("acme", { protocol: false, customDomain: "booking.acme.com" });

    expect(orgDomainsExport.getOrgFullOrigin).toHaveBeenCalledWith("booking.acme.com", {
      protocol: false,
      isCustomDomain: true,
    });
  });

  it("should forward protocol option without customDomain", () => {
    vi.mocked(orgDomainsExport.getOrgFullOrigin).mockReturnValue("acme.cal.com");

    getBookerBaseUrlSync("acme", { protocol: false });

    expect(orgDomainsExport.getOrgFullOrigin).toHaveBeenCalledWith("acme", { protocol: false });
  });
});
