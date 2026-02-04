import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("app/api/defaultResponderForAppDir", () => ({
  defaultResponderForAppDir:
    (handler: (req: NextRequest, context: { params: Promise<Record<string, string>> }) => Promise<Response>) =>
    (req: NextRequest, context: { params: Promise<Record<string, string>> }) =>
      handler(req, context),
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

const createMockRequest = (url: string): NextRequest => {
  const urlObj = new URL(url);
  return {
    method: "GET",
    url,
    nextUrl: urlObj,
    headers: new Headers(),
  } as unknown as NextRequest;
};

describe("avatar route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("caching headers optimization", () => {
    it("should include public directive for CDN caching", async () => {
      mockFindUniqueOrThrow.mockResolvedValue({
        data: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      });

      const req = createMockRequest("https://app.cal.com/api/avatar/test-uuid");
      const response = await GET(req, { params: Promise.resolve({ uuid: "test-uuid" }) });

      expect(response.headers.get("Cache-Control")).toContain("public");
    });

    it("should include s-maxage for CDN edge caching", async () => {
      mockFindUniqueOrThrow.mockResolvedValue({
        data: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      });

      const req = createMockRequest("https://app.cal.com/api/avatar/test-uuid");
      const response = await GET(req, { params: Promise.resolve({ uuid: "test-uuid" }) });

      expect(response.headers.get("Cache-Control")).toContain("s-maxage=86400");
    });

    it("should include stale-while-revalidate for better cache hit rates", async () => {
      mockFindUniqueOrThrow.mockResolvedValue({
        data: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      });

      const req = createMockRequest("https://app.cal.com/api/avatar/test-uuid");
      const response = await GET(req, { params: Promise.resolve({ uuid: "test-uuid" }) });

      expect(response.headers.get("Cache-Control")).toContain("stale-while-revalidate=604800");
    });

    it("should include max-age for client-side caching", async () => {
      mockFindUniqueOrThrow.mockResolvedValue({
        data: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      });

      const req = createMockRequest("https://app.cal.com/api/avatar/test-uuid");
      const response = await GET(req, { params: Promise.resolve({ uuid: "test-uuid" }) });

      expect(response.headers.get("Cache-Control")).toContain("max-age=86400");
    });

    it("should have complete Cache-Control header with all directives", async () => {
      mockFindUniqueOrThrow.mockResolvedValue({
        data: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      });

      const req = createMockRequest("https://app.cal.com/api/avatar/test-uuid");
      const response = await GET(req, { params: Promise.resolve({ uuid: "test-uuid" }) });

      expect(response.headers.get("Cache-Control")).toBe(
        "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800"
      );
    });
  });

  describe("avatar retrieval", () => {
    it("should return PNG image with correct content type", async () => {
      mockFindUniqueOrThrow.mockResolvedValue({
        data: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      });

      const req = createMockRequest("https://app.cal.com/api/avatar/test-uuid");
      const response = await GET(req, { params: Promise.resolve({ uuid: "test-uuid" }) });

      expect(response.headers.get("Content-Type")).toBe("image/png");
      expect(response.status).toBe(200);
    });

    it("should handle JPEG images correctly", async () => {
      mockFindUniqueOrThrow.mockResolvedValue({
        data: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBEQCEAwEPwAB//9k=",
      });

      const req = createMockRequest("https://app.cal.com/api/avatar/test-uuid");
      const response = await GET(req, { params: Promise.resolve({ uuid: "test-uuid" }) });

      expect(response.headers.get("Content-Type")).toBe("image/png");
      expect(response.status).toBe(200);
    });

    it("should strip file extension from uuid parameter", async () => {
      mockFindUniqueOrThrow.mockResolvedValue({
        data: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      });

      const req = createMockRequest("https://app.cal.com/api/avatar/test-uuid.png");
      await GET(req, { params: Promise.resolve({ uuid: "test-uuid.png" }) });

      expect(mockFindUniqueOrThrow).toHaveBeenCalledWith({
        where: { objectKey: "test-uuid" },
        select: { data: true },
      });
    });
  });

  describe("fallback behavior", () => {
    it("should redirect to fallback avatar when avatar not found", async () => {
      mockFindUniqueOrThrow.mockRejectedValue(new Error("Not found"));

      const req = createMockRequest("https://app.cal.com/api/avatar/nonexistent-uuid");
      const response = await GET(req, { params: Promise.resolve({ uuid: "nonexistent-uuid" }) });

      expect(response.status).toBe(302);
      expect(response.headers.get("location")).toBe("https://app.cal.com/avatar-fallback.png");
    });

    it("should redirect to fallback avatar on any error", async () => {
      mockFindUniqueOrThrow.mockRejectedValue(new Error("Database error"));

      const req = createMockRequest("https://app.cal.com/api/avatar/test-uuid");
      const response = await GET(req, { params: Promise.resolve({ uuid: "test-uuid" }) });

      expect(response.status).toBe(302);
    });
  });

  describe("SVG conversion", () => {
    it("should convert SVG to PNG and update database", async () => {
      const { convertSvgToPng } = await import("@calcom/lib/server/imageUtils");

      mockFindUniqueOrThrow.mockResolvedValue({
        data: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjwvc3ZnPg==",
      });
      mockUpdate.mockResolvedValue({});

      const req = createMockRequest("https://app.cal.com/api/avatar/svg-uuid");
      await GET(req, { params: Promise.resolve({ uuid: "svg-uuid" }) });

      expect(convertSvgToPng).toHaveBeenCalled();
      expect(mockUpdate).toHaveBeenCalledWith({
        where: { objectKey: "svg-uuid" },
        data: { data: "data:image/png;base64,converted" },
      });
    });
  });

  describe("validation", () => {
    it("should return 400 for invalid uuid parameter", async () => {
      const req = createMockRequest("https://app.cal.com/api/avatar/");
      const response = await GET(req, { params: Promise.resolve({}) });

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.message).toBe("VALIDATION_ERROR");
    });
  });
});
