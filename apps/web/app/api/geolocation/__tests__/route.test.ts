import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("app/api/defaultResponderForAppDir", () => ({
  defaultResponderForAppDir: (handler: () => Promise<Response>) => handler,
}));

const mockHeadersGet = vi.fn();

vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue({
    get: (name: string) => mockHeadersGet(name),
  }),
}));

import { GET } from "../route";

describe("geolocation route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("caching headers optimization", () => {
    it("should include public directive for CDN caching", async () => {
      mockHeadersGet.mockReturnValue("US");

      const response = await GET();

      expect(response.headers.get("Cache-Control")).toContain("public");
    });

    it("should include s-maxage for CDN edge caching", async () => {
      mockHeadersGet.mockReturnValue("US");

      const response = await GET();

      expect(response.headers.get("Cache-Control")).toContain("s-maxage=3600");
    });

    it("should include stale-while-revalidate for better cache hit rates", async () => {
      mockHeadersGet.mockReturnValue("US");

      const response = await GET();

      expect(response.headers.get("Cache-Control")).toContain("stale-while-revalidate=86400");
    });

    it("should include max-age for client-side caching", async () => {
      mockHeadersGet.mockReturnValue("US");

      const response = await GET();

      expect(response.headers.get("Cache-Control")).toContain("max-age=3600");
    });

    it("should have complete Cache-Control header with all directives", async () => {
      mockHeadersGet.mockReturnValue("US");

      const response = await GET();

      expect(response.headers.get("Cache-Control")).toBe(
        "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400"
      );
    });
  });

  describe("country detection", () => {
    it("should return country from x-vercel-ip-country header", async () => {
      mockHeadersGet.mockImplementation((name: string) => {
        if (name === "x-vercel-ip-country") return "US";
        return null;
      });

      const response = await GET();
      const body = await response.json();

      expect(body.country).toBe("US");
    });

    it("should return Unknown when x-vercel-ip-country header is missing", async () => {
      mockHeadersGet.mockReturnValue(null);

      const response = await GET();
      const body = await response.json();

      expect(body.country).toBe("Unknown");
    });

    it("should handle various country codes", async () => {
      const countryCodes = ["GB", "DE", "FR", "JP", "AU", "BR", "IN"];

      for (const code of countryCodes) {
        mockHeadersGet.mockImplementation((name: string) => {
          if (name === "x-vercel-ip-country") return code;
          return null;
        });

        const response = await GET();
        const body = await response.json();

        expect(body.country).toBe(code);
      }
    });
  });

  describe("response format", () => {
    it("should return JSON response", async () => {
      mockHeadersGet.mockReturnValue("US");

      const response = await GET();

      expect(response.headers.get("content-type")).toContain("application/json");
    });

    it("should return 200 status code", async () => {
      mockHeadersGet.mockReturnValue("US");

      const response = await GET();

      expect(response.status).toBe(200);
    });

    it("should return object with country property", async () => {
      mockHeadersGet.mockReturnValue("CA");

      const response = await GET();
      const body = await response.json();

      expect(body).toHaveProperty("country");
      expect(typeof body.country).toBe("string");
    });
  });
});
