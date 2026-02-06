import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("app/api/defaultResponderForAppDir", () => ({
  defaultResponderForAppDir: (handler: (req: NextRequest, context: { params: Promise<Record<string, string>> }) => Promise<Response>) => handler,
}));

vi.mock("@calcom/lib/constants", () => ({
  AVATAR_FALLBACK: "/avatar-fallback.png",
  WEBAPP_URL: "https://app.cal.com",
}));

vi.mock("@calcom/lib/server/imageUtils", () => ({
  convertSvgToPng: vi.fn().mockResolvedValue("data:image/png;base64,converted"),
}));

const mockFindUniqueOrThrow = vi.fn();
const mockUpdate = vi.fn();

vi.mock("@calcom/prisma", () => ({
  default: {
    avatar: {
      findUniqueOrThrow: (...args: unknown[]) => mockFindUniqueOrThrow(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
  },
}));

import { GET } from "../route";

const mockRequest = (url: string): NextRequest => ({
  method: "GET",
  url,
  nextUrl: new URL(url),
  headers: new Headers(),
}) as unknown as NextRequest;

const PNG_DATA_URL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
const SVG_DATA_URL = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjwvc3ZnPg==";

describe("avatar route", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns avatar with proper cache headers", async () => {
    mockFindUniqueOrThrow.mockResolvedValue({ data: PNG_DATA_URL });

    const req = mockRequest("https://app.cal.com/api/avatar/test-uuid");
    const res = await GET(req, { params: Promise.resolve({ uuid: "test-uuid" }) });

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/png");
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800");
  });

  it("strips file extension from uuid parameter", async () => {
    mockFindUniqueOrThrow.mockResolvedValue({ data: PNG_DATA_URL });

    const req = mockRequest("https://app.cal.com/api/avatar/test-uuid.png");
    await GET(req, { params: Promise.resolve({ uuid: "test-uuid.png" }) });

    expect(mockFindUniqueOrThrow).toHaveBeenCalledWith({
      where: { objectKey: "test-uuid" },
      select: { data: true },
    });
  });

  it("converts SVG to PNG and updates database", async () => {
    const { convertSvgToPng } = await import("@calcom/lib/server/imageUtils");
    mockFindUniqueOrThrow.mockResolvedValue({ data: SVG_DATA_URL });
    mockUpdate.mockResolvedValue({});

    const req = mockRequest("https://app.cal.com/api/avatar/svg-uuid");
    await GET(req, { params: Promise.resolve({ uuid: "svg-uuid" }) });

    expect(convertSvgToPng).toHaveBeenCalled();
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { objectKey: "svg-uuid" },
      data: { data: "data:image/png;base64,converted" },
    });
  });

  it("redirects to fallback on error", async () => {
    mockFindUniqueOrThrow.mockRejectedValue(new Error("Not found"));

    const req = mockRequest("https://app.cal.com/api/avatar/nonexistent");
    const res = await GET(req, { params: Promise.resolve({ uuid: "nonexistent" }) });

    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("https://app.cal.com/avatar-fallback.png");
  });

  it("returns 400 for missing uuid", async () => {
    const req = mockRequest("https://app.cal.com/api/avatar/");
    const res = await GET(req, { params: Promise.resolve({}) });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toBe("VALIDATION_ERROR");
  });
});
