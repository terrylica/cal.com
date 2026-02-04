import type { NextRequest } from "next/server";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("app/api/defaultResponderForAppDir", () => ({
  defaultResponderForAppDir:
    (handler: (req: NextRequest) => Promise<Response>) =>
    (req: NextRequest, _context: { params: Promise<Record<string, string>> }) =>
      handler(req),
}));

vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
  cookies: vi.fn().mockResolvedValue({ getAll: () => [] }),
}));

vi.mock("next/server", async () => {
  const { vi: vitest } = await import("vitest");
  return {
    NextResponse: {
      redirect: vitest.fn((url: string | URL, init?: { status?: number; headers?: Record<string, string> }) => {
        const location = typeof url === "string" ? url : url.toString();
        const headers = new Map(Object.entries(init?.headers || {}));
        headers.set("location", location);
        return {
          status: init?.status ?? 302,
          headers: {
            get: (name: string) => headers.get(name.toLowerCase()) || null,
          },
        } as unknown as Response;
      }),
      json: vitest.fn((data: unknown, init?: { status?: number }) => {
        return {
          status: init?.status ?? 200,
          json: async () => data,
          headers: {
            get: () => null,
          },
        } as unknown as Response;
      }),
    },
  };
});

vi.mock("@calcom/features/ee/organizations/lib/orgDomains", () => ({
  orgDomainConfig: vi.fn().mockReturnValue({ isValidOrgDomain: false }),
}));

vi.mock("@calcom/lib/constants", () => ({
  ANDROID_CHROME_ICON_192: "/android-chrome-192x192.png",
  ANDROID_CHROME_ICON_256: "/android-chrome-256x256.png",
  APPLE_TOUCH_ICON: "/apple-touch-icon.png",
  FAVICON_16: "/favicon-16x16.png",
  FAVICON_32: "/favicon-32x32.png",
  IS_SELF_HOSTED: false,
  LOGO: "/calcom-logo-white-word.svg",
  LOGO_ICON: "/cal-com-icon-white.svg",
  MSTILE_ICON: "/mstile-150x150.png",
  WEBAPP_URL: "https://app.cal.com",
}));

vi.mock("@calcom/lib/logger", () => ({
  default: {
    getSubLogger: () => ({
      debug: vi.fn(),
      error: vi.fn(),
    }),
  },
}));

vi.mock("@calcom/lib/ssrfProtection", () => ({
  isTrustedInternalUrl: vi.fn().mockReturnValue(true),
  logBlockedSSRFAttempt: vi.fn(),
  validateUrlForSSRF: vi.fn().mockResolvedValue({ isValid: true }),
}));

vi.mock("@lib/buildLegacyCtx", () => ({
  buildLegacyRequest: vi.fn().mockReturnValue({}),
}));

vi.mock("@calcom/prisma", () => {
  const mockTeamFindFirst = vi.fn().mockResolvedValue(null);
  return {
    default: {
      team: {
        findFirst: mockTeamFindFirst,
      },
    },
  };
});

import { NextResponse } from "next/server";
import { GET } from "../route";

const createMockRequest = (url: string, host?: string): NextRequest => {
  const urlObj = new URL(url);
  const headers = new Headers();
  headers.set("host", host || urlObj.host);
  return {
    method: "GET",
    url,
    nextUrl: urlObj,
    headers,
  } as unknown as NextRequest;
};

describe("logo route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("shouldUseDefaultLogo optimization", () => {
    it("should redirect to static logo for app.cal.com (system subdomain)", async () => {
      const req = createMockRequest("https://app.cal.com/api/logo", "app.cal.com");

      const res = await GET(req, { params: Promise.resolve({}) });

      expect(NextResponse.redirect).toHaveBeenCalled();
      expect(res.status).toBe(302);
      const location = res.headers.get("location");
      expect(location).toContain("/calcom-logo-white-word.svg");
    });

    it("should redirect to static logo for console.cal.com (system subdomain)", async () => {
      const req = createMockRequest("https://console.cal.com/api/logo", "console.cal.com");

      const res = await GET(req, { params: Promise.resolve({}) });

      expect(NextResponse.redirect).toHaveBeenCalled();
      expect(res.status).toBe(302);
    });

    it("should redirect to static logo for www.cal.com (system subdomain)", async () => {
      const req = createMockRequest("https://www.cal.com/api/logo", "www.cal.com");

      const res = await GET(req, { params: Promise.resolve({}) });

      expect(NextResponse.redirect).toHaveBeenCalled();
      expect(res.status).toBe(302);
    });

    it("should redirect to static logo when no subdomain", async () => {
      const req = createMockRequest("https://cal.com/api/logo", "cal.com");

      const res = await GET(req, { params: Promise.resolve({}) });

      expect(NextResponse.redirect).toHaveBeenCalled();
      expect(res.status).toBe(302);
    });
  });

  describe("caching headers", () => {
    it("should include proper Cache-Control headers in redirect response", async () => {
      const req = createMockRequest("https://app.cal.com/api/logo", "app.cal.com");

      await GET(req, { params: Promise.resolve({}) });

      expect(NextResponse.redirect).toHaveBeenCalledWith(
        expect.any(URL),
        expect.objectContaining({
          status: 302,
          headers: expect.objectContaining({
            "Cache-Control": "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800",
          }),
        })
      );
    });

    it("should have 7-day stale-while-revalidate for better cache hit rates", async () => {
      const req = createMockRequest("https://app.cal.com/api/logo", "app.cal.com");

      await GET(req, { params: Promise.resolve({}) });

      const mockCalls = vi.mocked(NextResponse.redirect).mock.calls;
      const callArgs = mockCalls[0];
      const init = callArgs[1] as { headers?: Record<string, string> } | undefined;
      expect(init?.headers?.["Cache-Control"]).toContain("stale-while-revalidate=604800");
    });

    it("should include public directive for CDN caching", async () => {
      const req = createMockRequest("https://app.cal.com/api/logo", "app.cal.com");

      await GET(req, { params: Promise.resolve({}) });

      const mockCalls = vi.mocked(NextResponse.redirect).mock.calls;
      const callArgs = mockCalls[0];
      const init = callArgs[1] as { headers?: Record<string, string> } | undefined;
      expect(init?.headers?.["Cache-Control"]).toContain("public");
    });

    it("should include max-age for client-side caching", async () => {
      const req = createMockRequest("https://app.cal.com/api/logo", "app.cal.com");

      await GET(req, { params: Promise.resolve({}) });

      const mockCalls = vi.mocked(NextResponse.redirect).mock.calls;
      const callArgs = mockCalls[0];
      const init = callArgs[1] as { headers?: Record<string, string> } | undefined;
      expect(init?.headers?.["Cache-Control"]).toContain("max-age=86400");
    });
  });

  describe("logo type handling", () => {
    it("should redirect to correct static path for favicon-32 type", async () => {
      const req = createMockRequest("https://app.cal.com/api/logo?type=favicon-32", "app.cal.com");

      await GET(req, { params: Promise.resolve({}) });

      const mockCalls = vi.mocked(NextResponse.redirect).mock.calls;
      const callArgs = mockCalls[0];
      const redirectUrl = callArgs[0] as URL;
      expect(redirectUrl.pathname).toBe("/favicon-32x32.png");
    });

    it("should redirect to correct static path for favicon-16 type", async () => {
      const req = createMockRequest("https://app.cal.com/api/logo?type=favicon-16", "app.cal.com");

      await GET(req, { params: Promise.resolve({}) });

      const mockCalls = vi.mocked(NextResponse.redirect).mock.calls;
      const callArgs = mockCalls[0];
      const redirectUrl = callArgs[0] as URL;
      expect(redirectUrl.pathname).toBe("/favicon-16x16.png");
    });

    it("should redirect to correct static path for icon type", async () => {
      const req = createMockRequest("https://app.cal.com/api/logo?type=icon", "app.cal.com");

      await GET(req, { params: Promise.resolve({}) });

      const mockCalls = vi.mocked(NextResponse.redirect).mock.calls;
      const callArgs = mockCalls[0];
      const redirectUrl = callArgs[0] as URL;
      expect(redirectUrl.pathname).toBe("/cal-com-icon-white.svg");
    });

    it("should redirect to correct static path for apple-touch-icon type", async () => {
      const req = createMockRequest("https://app.cal.com/api/logo?type=apple-touch-icon", "app.cal.com");

      await GET(req, { params: Promise.resolve({}) });

      const mockCalls = vi.mocked(NextResponse.redirect).mock.calls;
      const callArgs = mockCalls[0];
      const redirectUrl = callArgs[0] as URL;
      expect(redirectUrl.pathname).toBe("/apple-touch-icon.png");
    });

    it("should default to logo type when no type specified", async () => {
      const req = createMockRequest("https://app.cal.com/api/logo", "app.cal.com");

      await GET(req, { params: Promise.resolve({}) });

      const mockCalls = vi.mocked(NextResponse.redirect).mock.calls;
      const callArgs = mockCalls[0];
      const redirectUrl = callArgs[0] as URL;
      expect(redirectUrl.pathname).toBe("/calcom-logo-white-word.svg");
    });

    it("should default to logo type for invalid type parameter", async () => {
      const req = createMockRequest("https://app.cal.com/api/logo?type=invalid", "app.cal.com");

      await GET(req, { params: Promise.resolve({}) });

      const mockCalls = vi.mocked(NextResponse.redirect).mock.calls;
      const callArgs = mockCalls[0];
      const redirectUrl = callArgs[0] as URL;
      expect(redirectUrl.pathname).toBe("/calcom-logo-white-word.svg");
    });
  });

  describe("error handling", () => {
    it("should return 400 error when no hostname provided", async () => {
      const urlObj = new URL("https://app.cal.com/api/logo");
      const req = {
        method: "GET",
        url: "https://app.cal.com/api/logo",
        nextUrl: urlObj,
        headers: {
          get: () => null,
        },
      } as unknown as NextRequest;

      await GET(req, { params: Promise.resolve({}) });

      expect(NextResponse.json).toHaveBeenCalledWith({ error: "No hostname" }, { status: 400 });
    });
  });

  describe("redirect URL construction", () => {
    it("should construct redirect URL relative to request URL", async () => {
      const req = createMockRequest("https://app.cal.com/api/logo", "app.cal.com");

      await GET(req, { params: Promise.resolve({}) });

      const mockCalls = vi.mocked(NextResponse.redirect).mock.calls;
      const callArgs = mockCalls[0];
      const redirectUrl = callArgs[0] as URL;
      expect(redirectUrl.origin).toBe("https://app.cal.com");
    });

    it("should preserve custom domain in redirect URL", async () => {
      const req = createMockRequest("https://custom.example.com/api/logo", "custom.example.com");

      await GET(req, { params: Promise.resolve({}) });

      const mockCalls = vi.mocked(NextResponse.redirect).mock.calls;
      const callArgs = mockCalls[0];
      const redirectUrl = callArgs[0] as URL;
      expect(redirectUrl.origin).toBe("https://custom.example.com");
    });
  });
});

describe("self-hosted optimization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should redirect to static logo for self-hosted instances", async () => {
    vi.doMock("@calcom/lib/constants", () => ({
      ANDROID_CHROME_ICON_192: "/android-chrome-192x192.png",
      ANDROID_CHROME_ICON_256: "/android-chrome-256x256.png",
      APPLE_TOUCH_ICON: "/apple-touch-icon.png",
      FAVICON_16: "/favicon-16x16.png",
      FAVICON_32: "/favicon-32x32.png",
      IS_SELF_HOSTED: true,
      LOGO: "/calcom-logo-white-word.svg",
      LOGO_ICON: "/cal-com-icon-white.svg",
      MSTILE_ICON: "/mstile-150x150.png",
      WEBAPP_URL: "https://self-hosted.example.com",
    }));

    const req = createMockRequest("https://org.self-hosted.example.com/api/logo", "org.self-hosted.example.com");

    await GET(req, { params: Promise.resolve({}) });

    expect(NextResponse.redirect).toHaveBeenCalled();
  });
});
