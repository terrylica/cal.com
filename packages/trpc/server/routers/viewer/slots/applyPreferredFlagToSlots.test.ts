import { describe, it, expect } from "vitest";

import dayjs from "@calcom/dayjs";

import { applyPreferredFlagToSlots } from "./util";

describe("applyPreferredFlagToSlots", () => {
  describe("auto mode - prefer mornings", () => {
    const config = { mode: "auto" as const, auto: { preferTimeOfDay: "morning" as const } };

    it("marks morning slots (before 12pm) as preferred", () => {
      const slots = {
        "2026-03-10": [
          { time: "2026-03-10T08:00:00.000Z" },
          { time: "2026-03-10T09:30:00.000Z" },
          { time: "2026-03-10T11:00:00.000Z" },
        ],
      };

      const result = applyPreferredFlagToSlots({
        slots,
        config,
        timeZone: "UTC",
        eventLength: 30,
        preferredDateRanges: null,
      });

      expect(result["2026-03-10"][0].preferred).toBe(true);
      expect(result["2026-03-10"][1].preferred).toBe(true);
      expect(result["2026-03-10"][2].preferred).toBe(true);
    });

    it("marks afternoon slots (12pm+) as not preferred", () => {
      const slots = {
        "2026-03-10": [
          { time: "2026-03-10T12:00:00.000Z" },
          { time: "2026-03-10T14:00:00.000Z" },
          { time: "2026-03-10T17:30:00.000Z" },
        ],
      };

      const result = applyPreferredFlagToSlots({
        slots,
        config,
        timeZone: "UTC",
        eventLength: 30,
        preferredDateRanges: null,
      });

      expect(result["2026-03-10"][0].preferred).toBe(false);
      expect(result["2026-03-10"][1].preferred).toBe(false);
      expect(result["2026-03-10"][2].preferred).toBe(false);
    });

    it("handles timezone conversion correctly", () => {
      const slots = {
        "2026-03-10": [
          { time: "2026-03-10T16:00:00.000Z" },
          { time: "2026-03-10T20:00:00.000Z" },
        ],
      };

      const result = applyPreferredFlagToSlots({
        slots,
        config,
        timeZone: "America/New_York",
        eventLength: 30,
        preferredDateRanges: null,
      });

      expect(result["2026-03-10"][0].preferred).toBe(false);
      expect(result["2026-03-10"][1].preferred).toBe(false);
    });

    it("handles mixed morning and afternoon slots", () => {
      const slots = {
        "2026-03-10": [
          { time: "2026-03-10T09:00:00.000Z" },
          { time: "2026-03-10T11:30:00.000Z" },
          { time: "2026-03-10T12:00:00.000Z" },
          { time: "2026-03-10T15:00:00.000Z" },
        ],
      };

      const result = applyPreferredFlagToSlots({
        slots,
        config,
        timeZone: "UTC",
        eventLength: 30,
        preferredDateRanges: null,
      });

      expect(result["2026-03-10"][0].preferred).toBe(true);
      expect(result["2026-03-10"][1].preferred).toBe(true);
      expect(result["2026-03-10"][2].preferred).toBe(false);
      expect(result["2026-03-10"][3].preferred).toBe(false);
    });
  });

  describe("auto mode - prefer afternoons", () => {
    const config = { mode: "auto" as const, auto: { preferTimeOfDay: "afternoon" as const } };

    it("marks afternoon slots as preferred", () => {
      const slots = {
        "2026-03-10": [
          { time: "2026-03-10T12:00:00.000Z" },
          { time: "2026-03-10T14:00:00.000Z" },
        ],
      };

      const result = applyPreferredFlagToSlots({
        slots,
        config,
        timeZone: "UTC",
        eventLength: 30,
        preferredDateRanges: null,
      });

      expect(result["2026-03-10"][0].preferred).toBe(true);
      expect(result["2026-03-10"][1].preferred).toBe(true);
    });

    it("marks morning slots as not preferred", () => {
      const slots = {
        "2026-03-10": [
          { time: "2026-03-10T08:00:00.000Z" },
          { time: "2026-03-10T10:00:00.000Z" },
        ],
      };

      const result = applyPreferredFlagToSlots({
        slots,
        config,
        timeZone: "UTC",
        eventLength: 30,
        preferredDateRanges: null,
      });

      expect(result["2026-03-10"][0].preferred).toBe(false);
      expect(result["2026-03-10"][1].preferred).toBe(false);
    });

    it("converts timezone before determining morning/afternoon", () => {
      const slots = {
        "2026-03-10": [{ time: "2026-03-10T06:00:00.000Z" }],
      };

      const resultUTC = applyPreferredFlagToSlots({
        slots,
        config,
        timeZone: "UTC",
        eventLength: 30,
        preferredDateRanges: null,
      });
      expect(resultUTC["2026-03-10"][0].preferred).toBe(false);

      const resultTokyo = applyPreferredFlagToSlots({
        slots,
        config,
        timeZone: "Asia/Tokyo",
        eventLength: 30,
        preferredDateRanges: null,
      });
      expect(resultTokyo["2026-03-10"][0].preferred).toBe(true);
    });
  });

  describe("manual mode", () => {
    const config = { mode: "manual" as const, manual: { scheduleId: 1 } };

    it("marks slots within preferred date ranges as preferred", () => {
      const preferredDateRanges = [
        {
          start: dayjs.utc("2026-03-10T09:00:00.000Z"),
          end: dayjs.utc("2026-03-10T12:00:00.000Z"),
        },
      ];

      const slots = {
        "2026-03-10": [
          { time: "2026-03-10T09:00:00.000Z" },
          { time: "2026-03-10T09:30:00.000Z" },
          { time: "2026-03-10T11:00:00.000Z" },
        ],
      };

      const result = applyPreferredFlagToSlots({
        slots,
        config,
        timeZone: "UTC",
        eventLength: 30,
        preferredDateRanges,
      });

      expect(result["2026-03-10"][0].preferred).toBe(true);
      expect(result["2026-03-10"][1].preferred).toBe(true);
      expect(result["2026-03-10"][2].preferred).toBe(true);
    });

    it("marks slots outside preferred date ranges as not preferred", () => {
      const preferredDateRanges = [
        {
          start: dayjs.utc("2026-03-10T09:00:00.000Z"),
          end: dayjs.utc("2026-03-10T12:00:00.000Z"),
        },
      ];

      const slots = {
        "2026-03-10": [
          { time: "2026-03-10T08:00:00.000Z" },
          { time: "2026-03-10T13:00:00.000Z" },
          { time: "2026-03-10T15:00:00.000Z" },
        ],
      };

      const result = applyPreferredFlagToSlots({
        slots,
        config,
        timeZone: "UTC",
        eventLength: 30,
        preferredDateRanges,
      });

      expect(result["2026-03-10"][0].preferred).toBe(false);
      expect(result["2026-03-10"][1].preferred).toBe(false);
      expect(result["2026-03-10"][2].preferred).toBe(false);
    });

    it("handles slot that extends beyond the preferred range end", () => {
      const preferredDateRanges = [
        {
          start: dayjs.utc("2026-03-10T09:00:00.000Z"),
          end: dayjs.utc("2026-03-10T10:00:00.000Z"),
        },
      ];

      const slots = {
        "2026-03-10": [{ time: "2026-03-10T09:45:00.000Z" }],
      };

      const result = applyPreferredFlagToSlots({
        slots,
        config,
        timeZone: "UTC",
        eventLength: 30,
        preferredDateRanges,
      });

      expect(result["2026-03-10"][0].preferred).toBe(false);
    });

    it("handles multiple preferred date ranges", () => {
      const preferredDateRanges = [
        {
          start: dayjs.utc("2026-03-10T09:00:00.000Z"),
          end: dayjs.utc("2026-03-10T10:00:00.000Z"),
        },
        {
          start: dayjs.utc("2026-03-10T14:00:00.000Z"),
          end: dayjs.utc("2026-03-10T16:00:00.000Z"),
        },
      ];

      const slots = {
        "2026-03-10": [
          { time: "2026-03-10T09:00:00.000Z" },
          { time: "2026-03-10T11:00:00.000Z" },
          { time: "2026-03-10T14:30:00.000Z" },
        ],
      };

      const result = applyPreferredFlagToSlots({
        slots,
        config,
        timeZone: "UTC",
        eventLength: 30,
        preferredDateRanges,
      });

      expect(result["2026-03-10"][0].preferred).toBe(true);
      expect(result["2026-03-10"][1].preferred).toBe(false);
      expect(result["2026-03-10"][2].preferred).toBe(true);
    });

    it("returns slots unchanged when preferredDateRanges is null", () => {
      const slots = {
        "2026-03-10": [{ time: "2026-03-10T09:00:00.000Z" }],
      };

      const result = applyPreferredFlagToSlots({
        slots,
        config,
        timeZone: "UTC",
        eventLength: 30,
        preferredDateRanges: null,
      });

      expect(result["2026-03-10"][0]).toEqual({ time: "2026-03-10T09:00:00.000Z" });
      expect(result["2026-03-10"][0]).not.toHaveProperty("preferred");
    });

    it("uses eventLength to compute slot end for boundary check", () => {
      const preferredDateRanges = [
        {
          start: dayjs.utc("2026-03-10T09:00:00.000Z"),
          end: dayjs.utc("2026-03-10T10:00:00.000Z"),
        },
      ];

      const slots = {
        "2026-03-10": [{ time: "2026-03-10T09:00:00.000Z" }],
      };

      const result30 = applyPreferredFlagToSlots({
        slots,
        config,
        timeZone: "UTC",
        eventLength: 30,
        preferredDateRanges,
      });
      expect(result30["2026-03-10"][0].preferred).toBe(true);

      const result90 = applyPreferredFlagToSlots({
        slots,
        config,
        timeZone: "UTC",
        eventLength: 90,
        preferredDateRanges,
      });
      expect(result90["2026-03-10"][0].preferred).toBe(false);
    });

    it("marks slot at exact range boundary as preferred", () => {
      const preferredDateRanges = [
        {
          start: dayjs.utc("2026-03-10T09:00:00.000Z"),
          end: dayjs.utc("2026-03-10T09:30:00.000Z"),
        },
      ];

      const slots = {
        "2026-03-10": [{ time: "2026-03-10T09:00:00.000Z" }],
      };

      const result = applyPreferredFlagToSlots({
        slots,
        config,
        timeZone: "UTC",
        eventLength: 30,
        preferredDateRanges,
      });

      expect(result["2026-03-10"][0].preferred).toBe(true);
    });
  });

  describe("multiple dates", () => {
    it("processes slots across multiple dates", () => {
      const config = { mode: "auto" as const, auto: { preferTimeOfDay: "morning" as const } };

      const slots = {
        "2026-03-10": [
          { time: "2026-03-10T08:00:00.000Z" },
          { time: "2026-03-10T14:00:00.000Z" },
        ],
        "2026-03-11": [
          { time: "2026-03-11T10:00:00.000Z" },
          { time: "2026-03-11T16:00:00.000Z" },
        ],
      };

      const result = applyPreferredFlagToSlots({
        slots,
        config,
        timeZone: "UTC",
        eventLength: 30,
        preferredDateRanges: null,
      });

      expect(result["2026-03-10"][0].preferred).toBe(true);
      expect(result["2026-03-10"][1].preferred).toBe(false);
      expect(result["2026-03-11"][0].preferred).toBe(true);
      expect(result["2026-03-11"][1].preferred).toBe(false);
    });
  });

  describe("preserves existing slot properties", () => {
    it("keeps attendees, bookingUid, and other fields intact", () => {
      const config = { mode: "auto" as const, auto: { preferTimeOfDay: "morning" as const } };

      const slots = {
        "2026-03-10": [
          { time: "2026-03-10T08:00:00.000Z", attendees: 3, bookingUid: "abc-123" },
        ],
      };

      const result = applyPreferredFlagToSlots({
        slots,
        config,
        timeZone: "UTC",
        eventLength: 30,
        preferredDateRanges: null,
      });

      expect(result["2026-03-10"][0]).toEqual({
        time: "2026-03-10T08:00:00.000Z",
        attendees: 3,
        bookingUid: "abc-123",
        preferred: true,
      });
    });
  });

  describe("edge cases", () => {
    it("handles empty slots object", () => {
      const config = { mode: "auto" as const, auto: { preferTimeOfDay: "morning" as const } };

      const result = applyPreferredFlagToSlots({
        slots: {},
        config,
        timeZone: "UTC",
        eventLength: 30,
        preferredDateRanges: null,
      });

      expect(result).toEqual({});
    });

    it("handles date with empty slots array", () => {
      const config = { mode: "auto" as const, auto: { preferTimeOfDay: "morning" as const } };

      const result = applyPreferredFlagToSlots({
        slots: { "2026-03-10": [] },
        config,
        timeZone: "UTC",
        eventLength: 30,
        preferredDateRanges: null,
      });

      expect(result["2026-03-10"]).toEqual([]);
    });

    it("auto mode without preferTimeOfDay returns slots unchanged", () => {
      const config = { mode: "auto" as const, auto: {} };

      const slots = {
        "2026-03-10": [{ time: "2026-03-10T08:00:00.000Z" }],
      };

      const result = applyPreferredFlagToSlots({
        slots,
        config,
        timeZone: "UTC",
        eventLength: 30,
        preferredDateRanges: null,
      });

      expect(result["2026-03-10"][0]).toEqual({ time: "2026-03-10T08:00:00.000Z" });
      expect(result["2026-03-10"][0]).not.toHaveProperty("preferred");
    });

    it("does not mutate the original slots object", () => {
      const config = { mode: "auto" as const, auto: { preferTimeOfDay: "morning" as const } };
      const originalSlot = { time: "2026-03-10T08:00:00.000Z" };
      const slots = { "2026-03-10": [originalSlot] };

      applyPreferredFlagToSlots({
        slots,
        config,
        timeZone: "UTC",
        eventLength: 30,
        preferredDateRanges: null,
      });

      expect(originalSlot).not.toHaveProperty("preferred");
      expect(slots["2026-03-10"][0]).not.toHaveProperty("preferred");
    });
  });
});
