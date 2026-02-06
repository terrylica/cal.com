import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("app/api/defaultResponderForAppDir", () => ({
  defaultResponderForAppDir: (handler: () => Promise<Response>) => handler,
}));

const mockHeadersGet = vi.fn();

vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue({ get: (name: string) => mockHeadersGet(name) }),
}));

import { GET } from "../route";

const mockRequest = {} as NextRequest;
const mockContext = { params: Promise.resolve({}) };

describe("geolocation route", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns country with proper cache headers", async () => {
    mockHeadersGet.mockReturnValue("US");

    const res = await GET(mockRequest, mockContext);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.country).toBe("US");
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400");
  });

  it("returns Unknown when x-vercel-ip-country header is missing", async () => {
    mockHeadersGet.mockReturnValue(null);

    const res = await GET(mockRequest, mockContext);
    const body = await res.json();

    expect(body.country).toBe("Unknown");
  });
});
