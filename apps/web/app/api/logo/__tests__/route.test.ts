import type { NextRequest } from "next/server";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";
import { GET } from "../route";

vi.mock("app/api/defaultResponderForAppDir", () => ({
  defaultResponderForAppDir: (handler: (req: NextRequest) => Promise<Response>) => handler,
}));

vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
  cookies: vi.fn().mockResolvedValue({ getAll: () => [] }),
}));

vi.mock("next/server", () => ({
  NextResponse: {
    redirect: vi.fn((url: string | URL, init?: { status?: number; headers?: Record<string, string> }) => {
      const location = typeof url === "string" ? url : url.toString();
      const headers = new Map(Object.entries(init?.headers || {}));
      headers.set("location", location);
      return {
        status: init?.status ?? 302,
        headers: { get: (name: string) => headers.get(name.toLowerCase()) || null },
      } as unknown as Response;
    }),
    json: vi.fn((data: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => data,
      headers: { get: () => null },
    })),
  },
}));

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
  default: { getSubLogger: () => ({ debug: vi.fn(), error: vi.fn() }) },
}));

vi.mock("@calcom/lib/ssrfProtection", () => ({
  isTrustedInternalUrl: vi.fn().mockReturnValue(true),
  logBlockedSSRFAttempt: vi.fn(),
  validateUrlForSSRF: vi.fn().mockResolvedValue({ isValid: true }),
}));

vi.mock("@lib/buildLegacyCtx", () => ({
  buildLegacyRequest: vi.fn().mockReturnValue({}),
}));

vi.mock("@calcom/prisma", () => ({
  default: { team: { findFirst: vi.fn().mockResolvedValue(null) } },
}));

const mockRequest = (url: string, host?: string): NextRequest => {
  const urlObj = new URL(url);
  const headers = new Headers();
  headers.set("host", host || urlObj.host);
  return { method: "GET", url, nextUrl: urlObj, headers } as unknown as NextRequest;
};

const getRedirectUrl = (): URL => {
  const calls = vi.mocked(NextResponse.redirect).mock.calls;
  return calls[calls.length - 1][0] as URL;
};

const getCacheControl = (): string => {
  const calls = vi.mocked(NextResponse.redirect).mock.calls;
  const init = calls[calls.length - 1][1] as { headers?: Record<string, string> };
  return init.headers?.["Cache-Control"] || "";
};

describe("logo route", () => {
  beforeEach(() => vi.clearAllMocks());

  it("redirects system subdomains to static logo", async () => {
    const systemSubdomains = ["app.cal.com", "console.cal.com", "www.cal.com", "cal.com"];

    for (const host of systemSubdomains) {
      vi.clearAllMocks();
      const req = mockRequest(`https://${host}/api/logo`, host);
      const res = await GET(req, { params: Promise.resolve({}) });

      expect(res.status).toBe(302);
      expect(getRedirectUrl().pathname).toBe("/calcom-logo-white-word.svg");
    }
  });

  it("sets proper cache headers with 7-day stale-while-revalidate", async () => {
    const req = mockRequest("https://app.cal.com/api/logo", "app.cal.com");
    await GET(req, { params: Promise.resolve({}) });

    const cacheControl = getCacheControl();
    expect(cacheControl).toBe("public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800");
  });

  it("handles different logo types correctly", async () => {
    const types = [
      { param: "favicon-32", expected: "/favicon-32x32.png" },
      { param: "icon", expected: "/cal-com-icon-white.svg" },
      { param: "invalid", expected: "/calcom-logo-white-word.svg" },
    ];

    for (const { param, expected } of types) {
      vi.clearAllMocks();
      const req = mockRequest(`https://app.cal.com/api/logo?type=${param}`, "app.cal.com");
      await GET(req, { params: Promise.resolve({}) });

      expect(getRedirectUrl().pathname).toBe(expected);
    }
  });

  it("returns 400 when hostname is missing", async () => {
    const req = {
      method: "GET",
      url: "https://app.cal.com/api/logo",
      nextUrl: new URL("https://app.cal.com/api/logo"),
      headers: { get: () => null },
    } as unknown as NextRequest;

    await GET(req, { params: Promise.resolve({}) });

    expect(NextResponse.json).toHaveBeenCalledWith({ error: "No hostname" }, { status: 400 });
  });
});
