import { describe, expect, test, vi } from "vitest";

import CalStudioVideoApiAdapter from "./VideoApiAdapter";

vi.mock("uuid", () => ({
  v4: () => "test-uuid-1234-5678-abcd",
}));

describe("CalStudioVideoApiAdapter", () => {
  describe("getAvailability", () => {
    test("returns empty array", async () => {
      const adapter = CalStudioVideoApiAdapter();
      const availability = await adapter.getAvailability();
      expect(availability).toEqual([]);
    });
  });

  describe("createMeeting", () => {
    test("returns meeting data with correct URL format", async () => {
      const adapter = CalStudioVideoApiAdapter();

      const event = {
        title: "Test Meeting",
        description: "Test Description",
        startTime: new Date("2026-01-01T10:00:00Z"),
        endTime: new Date("2026-01-01T11:00:00Z"),
      };

      const result = await adapter.createMeeting(event);

      expect(result).toEqual({
        type: "cal_studio_video",
        id: "test-uuid-1234-5678-abcd",
        password: "",
        url: "https://studio.cal.com/test-uuid-1234-5678-abcd",
      });
    });

    test("generates URL without /video/ path segment", async () => {
      const adapter = CalStudioVideoApiAdapter();

      const event = {
        title: "Test",
        startTime: new Date(),
        endTime: new Date(),
      };

      const result = await adapter.createMeeting(event);
      expect(result.url).not.toContain("/video/");
      expect(result.url).toMatch(/^https:\/\/studio\.cal\.com\/[a-z0-9-]+$/);
    });
  });

  describe("deleteMeeting", () => {
    test("resolves without error", async () => {
      const adapter = CalStudioVideoApiAdapter();
      await expect(adapter.deleteMeeting("meeting-123")).resolves.toBeUndefined();
    });
  });

  describe("updateMeeting", () => {
    test("returns meeting data from booking reference", async () => {
      const adapter = CalStudioVideoApiAdapter();

      const bookingRef = {
        meetingId: "existing-meeting-id",
        meetingPassword: "pass123",
        meetingUrl: "https://studio.cal.com/existing-meeting-id",
      };

      const result = await adapter.updateMeeting(bookingRef);

      expect(result).toEqual({
        type: "cal_studio_video",
        id: "existing-meeting-id",
        password: "pass123",
        url: "https://studio.cal.com/existing-meeting-id",
      });
    });
  });
});
