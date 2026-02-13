import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchCsrfToken } from "./fetchCsrfToken";

vi.mock("@calcom/lib/fetch-wrapper", () => ({
  get: vi.fn(),
}));

import { get } from "@calcom/lib/fetch-wrapper";

describe("fetchCsrfToken", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches a CSRF token from /api/csrf", async () => {
    const mockToken = "a".repeat(64);
    vi.mocked(get).mockResolvedValue({ csrfToken: mockToken });

    const token = await fetchCsrfToken();

    expect(get).toHaveBeenCalledWith("/api/csrf");
    expect(token).toBe(mockToken);
  });

  it("propagates errors from the fetch call", async () => {
    vi.mocked(get).mockRejectedValue(new Error("Network error"));

    await expect(fetchCsrfToken()).rejects.toThrow("Network error");
  });
});
