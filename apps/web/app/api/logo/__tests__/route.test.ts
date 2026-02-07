import type { NextRequest } from "next/server";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";
import { GET } from "../route";

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

vi.mock("next/server", () => {
  return {
    NextResponse: {
      redirect: vi.fn((url: string | URL, init: { status: number; headers?: Record<string, string> }) => {
        const location = typeof url === "string" ? url : url.toString();
        const headers = new Map(Object.entries(init.headers || {}));
        headers.set("location", location);
        return {
          status: init.status,
          headers: {
            get: (name: string) => headers.get(name.toLowerCase()) || null,
          },
        };
      }),
      json: vi.fn((data: unknown, init: { status: number }) => {
        return {
          status: init.status,
          json: async () => data,
          headers: {
            get: () => null,
          },
        };
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

describe("logo route - 302 redirects", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should redirect with 302 status for system subdomains", async () => {
    const req = createMockRequest("https://app.cal.com/api/logo", "app.cal.com");

    const res = await GET(req, { params: Promise.resolve({}) });

    expect(NextResponse.redirect).toHaveBeenCalledWith(expect.any(URL), { status: 302 });
    expect(res.status).toBe(302);
    const location = res.headers.get("location");
    expect(location).toContain("/calcom-logo-white-word.svg");
  });

  it("should redirect to correct static path based on type parameter", async () => {
    const req = createMockRequest("https://app.cal.com/api/logo?type=favicon-32", "app.cal.com");

    const res = await GET(req, { params: Promise.resolve({}) });

    const mockCalls = vi.mocked(NextResponse.redirect).mock.calls;
    const redirectUrl = mockCalls[0][0] as URL;
    expect(redirectUrl.pathname).toBe("/favicon-32x32.png");
    expect(res.status).toBe(302);
  });

  it("should redirect to logo type when no type specified", async () => {
    const req = createMockRequest("https://app.cal.com/api/logo", "app.cal.com");

    await GET(req, { params: Promise.resolve({}) });

    const mockCalls = vi.mocked(NextResponse.redirect).mock.calls;
    const redirectUrl = mockCalls[0][0] as URL;
    expect(redirectUrl.pathname).toBe("/calcom-logo-white-word.svg");
  });

  it("should redirect to logo type for invalid type parameter", async () => {
    const req = createMockRequest("https://app.cal.com/api/logo?type=invalid", "app.cal.com");

    await GET(req, { params: Promise.resolve({}) });

    const mockCalls = vi.mocked(NextResponse.redirect).mock.calls;
    const redirectUrl = mockCalls[0][0] as URL;
    expect(redirectUrl.pathname).toBe("/calcom-logo-white-word.svg");
  });

  it("should preserve request origin in redirect URL", async () => {
    const req = createMockRequest("https://custom.example.com/api/logo", "custom.example.com");

    await GET(req, { params: Promise.resolve({}) });

    const mockCalls = vi.mocked(NextResponse.redirect).mock.calls;
    const redirectUrl = mockCalls[0][0] as URL;
    expect(redirectUrl.origin).toBe("https://custom.example.com");
  });
});
