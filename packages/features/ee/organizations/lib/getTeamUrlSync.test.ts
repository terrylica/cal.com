import { describe, it, vi, expect } from "vitest";

import * as getBookerBaseUrlSyncExport from "@calcom/features/ee/organizations/lib/getBookerBaseUrlSync";

import { getTeamUrlSync } from "./getTeamUrlSync";

vi.mock("@calcom/features/ee/organizations/lib/getBookerBaseUrlSync", async () => {
  return {
    getBookerBaseUrlSync: vi.fn(),
  };
});

describe("getBookerUrl:client", () => {
  describe("getTeamUrlSync", () => {
    it("if orgSlug is null, it should return a URL with /team in it", () => {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      getBookerBaseUrlSyncExport.getBookerBaseUrlSync.mockReturnValueOnce("https://abc.com");
      const url = getTeamUrlSync({ orgSlug: null, teamSlug: "myTeam" });
      expect(url).toBe("https://abc.com/team/myTeam");
    });

    it("if orgSlug is set, it should return a URL without /team in it", () => {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      getBookerBaseUrlSyncExport.getBookerBaseUrlSync.mockReturnValueOnce("https://acme.com");
      const url = getTeamUrlSync({ orgSlug: "acme", teamSlug: "myTeam" });
      expect(url).toBe("https://acme.com/myTeam");
    });

    it("if customDomain is set and orgSlug is null, it should return a URL without /team in it", () => {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      getBookerBaseUrlSyncExport.getBookerBaseUrlSync.mockReturnValueOnce("https://booking.acme.com");
      const url = getTeamUrlSync({ orgSlug: null, teamSlug: "myTeam", customDomain: "booking.acme.com" });
      expect(url).toBe("https://booking.acme.com/myTeam");
    });

    it("if both customDomain and orgSlug are set, it should return a URL without /team in it", () => {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      getBookerBaseUrlSyncExport.getBookerBaseUrlSync.mockReturnValueOnce("https://booking.acme.com");
      const url = getTeamUrlSync({
        orgSlug: "acme",
        teamSlug: "myTeam",
        customDomain: "booking.acme.com",
      });
      expect(url).toBe("https://booking.acme.com/myTeam");
    });

    it("should pass customDomain through to getBookerBaseUrlSync", () => {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      getBookerBaseUrlSyncExport.getBookerBaseUrlSync.mockReturnValueOnce("https://booking.acme.com");
      getTeamUrlSync({ orgSlug: null, teamSlug: "myTeam", customDomain: "booking.acme.com" });
      expect(getBookerBaseUrlSyncExport.getBookerBaseUrlSync).toHaveBeenCalledWith(null, {
        customDomain: "booking.acme.com",
      });
    });

    it("if customDomain is null and orgSlug is null, it should return URL with /team/", () => {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      getBookerBaseUrlSyncExport.getBookerBaseUrlSync.mockReturnValueOnce("https://abc.com");
      const url = getTeamUrlSync({ orgSlug: null, teamSlug: "myTeam", customDomain: null });
      expect(url).toBe("https://abc.com/team/myTeam");
    });
  });
});
