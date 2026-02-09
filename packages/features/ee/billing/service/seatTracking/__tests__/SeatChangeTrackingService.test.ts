import { describe, it, expect, vi, beforeEach } from "vitest";

import { SeatChangeTrackingService } from "../SeatChangeTrackingService";

vi.mock("@calcom/lib/logger", () => ({
  default: {
    getSubLogger: () => ({
      info: vi.fn(),
      debug: vi.fn(),
      error: vi.fn(),
    }),
  },
}));

const mockRepository = {
  getTeamBillingIds: vi.fn(),
  create: vi.fn(),
  getMonthlyChanges: vi.fn(),
  getUnprocessedChanges: vi.fn(),
  markAsProcessed: vi.fn(),
};

const mockHighWaterMarkRepo = {
  getByTeamId: vi.fn(),
  updateIfHigher: vi.fn(),
};

const mockTeamRepo = {
  getTeamMemberCount: vi.fn(),
};

const mockFeaturesRepository = {
  checkIfFeatureIsEnabledGlobally: vi.fn().mockResolvedValue(false),
};

describe("SeatChangeTrackingService", () => {
  let service: SeatChangeTrackingService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SeatChangeTrackingService({
      // @ts-expect-error - mock repository
      repository: mockRepository,
      // @ts-expect-error - mock repository
      highWaterMarkRepo: mockHighWaterMarkRepo,
      // @ts-expect-error - mock repository
      teamRepo: mockTeamRepo,
      // @ts-expect-error - mock repository
      featuresRepository: mockFeaturesRepository,
    });
  });

  describe("logSeatAddition", () => {
    it("should log seat addition with correct data", async () => {
      const teamId = 1;
      const userId = 100;
      const triggeredBy = 50;

      mockRepository.getTeamBillingIds.mockResolvedValue({
        teamBillingId: "team-billing-123",
        organizationBillingId: null,
      });
      mockRepository.create.mockResolvedValue(undefined);

      await service.logSeatAddition({
        teamId,
        userId,
        triggeredBy,
        seatCount: 1,
        metadata: { test: "data" },
      });

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          teamId,
          changeType: "ADDITION",
          seatCount: 1,
          userId,
          triggeredBy,
          teamBillingId: "team-billing-123",
          organizationBillingId: null,
        })
      );
    });

    it("should use organization billing ID for organizations", async () => {
      const teamId = 1;

      mockRepository.getTeamBillingIds.mockResolvedValue({
        teamBillingId: null,
        organizationBillingId: "org-billing-456",
      });
      mockRepository.create.mockResolvedValue(undefined);

      await service.logSeatAddition({
        teamId,
        userId: 100,
      });

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          teamBillingId: null,
          organizationBillingId: "org-billing-456",
        })
      );
    });

    it("should throw error if team not found", async () => {
      mockRepository.getTeamBillingIds.mockRejectedValue(new Error("Team 999 not found"));

      await expect(
        service.logSeatAddition({
          teamId: 999,
          userId: 100,
        })
      ).rejects.toThrow("Team 999 not found");
    });

    it("should calculate month key correctly", async () => {
      const teamId = 1;

      mockRepository.getTeamBillingIds.mockResolvedValue({
        teamBillingId: "team-billing-123",
        organizationBillingId: null,
      });
      mockRepository.create.mockResolvedValue(undefined);

      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-01-15T12:00:00Z"));

      await service.logSeatAddition({
        teamId,
        userId: 100,
      });

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          monthKey: "2026-01",
        })
      );

      vi.useRealTimers();
    });
  });

  describe("logSeatRemoval", () => {
    it("should log seat removal with correct data", async () => {
      const teamId = 1;
      const userId = 100;

      mockRepository.getTeamBillingIds.mockResolvedValue({
        teamBillingId: "team-billing-123",
        organizationBillingId: null,
      });
      mockRepository.create.mockResolvedValue(undefined);

      await service.logSeatRemoval({
        teamId,
        userId,
        seatCount: 2,
      });

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          teamId,
          changeType: "REMOVAL",
          seatCount: 2,
          userId,
        })
      );
    });
  });

  describe("getMonthlyChanges", () => {
    it("should calculate net change correctly", async () => {
      const teamId = 1;
      const monthKey = "2026-01";

      mockRepository.getMonthlyChanges.mockResolvedValue({
        additions: 10,
        removals: 3,
      });

      const result = await service.getMonthlyChanges({ teamId, monthKey });

      expect(result).toEqual({
        additions: 10,
        removals: 3,
        netChange: 7,
      });
    });

    it("should handle month with only additions", async () => {
      mockRepository.getMonthlyChanges.mockResolvedValue({
        additions: 5,
        removals: 0,
      });

      const result = await service.getMonthlyChanges({
        teamId: 1,
        monthKey: "2026-01",
      });

      expect(result).toEqual({
        additions: 5,
        removals: 0,
        netChange: 5,
      });
    });

    it("should handle month with only removals", async () => {
      mockRepository.getMonthlyChanges.mockResolvedValue({
        additions: 0,
        removals: 3,
      });

      const result = await service.getMonthlyChanges({
        teamId: 1,
        monthKey: "2026-01",
      });

      expect(result).toEqual({
        additions: 0,
        removals: 3,
        netChange: 0,
      });
    });

    it("should cap net change at 0 for negative values", async () => {
      mockRepository.getMonthlyChanges.mockResolvedValue({
        additions: 2,
        removals: 5,
      });

      const result = await service.getMonthlyChanges({
        teamId: 1,
        monthKey: "2026-01",
      });

      expect(result).toEqual({
        additions: 2,
        removals: 5,
        netChange: 0,
      });
    });

    it("should handle month with no changes", async () => {
      mockRepository.getMonthlyChanges.mockResolvedValue({
        additions: 0,
        removals: 0,
      });

      const result = await service.getMonthlyChanges({
        teamId: 1,
        monthKey: "2026-01",
      });

      expect(result).toEqual({
        additions: 0,
        removals: 0,
        netChange: 0,
      });
    });
  });

  describe("getUnprocessedChanges", () => {
    it("should fetch unprocessed changes for a team and month", async () => {
      const teamId = 1;
      const monthKey = "2026-01";

      const changes = [
        { id: "1", teamId, monthKey, changeType: "ADDITION" },
        { id: "2", teamId, monthKey, changeType: "REMOVAL" },
      ];

      mockRepository.getUnprocessedChanges.mockResolvedValue(changes);

      const result = await service.getUnprocessedChanges({ teamId, monthKey });

      expect(result).toEqual(changes);
      expect(mockRepository.getUnprocessedChanges).toHaveBeenCalledWith({ teamId, monthKey });
    });
  });

  describe("markAsProcessed", () => {
    it("should mark changes as processed and return count", async () => {
      const teamId = 1;
      const monthKey = "2026-01";
      const prorationId = "proration-123";

      mockRepository.markAsProcessed.mockResolvedValue(5);

      const count = await service.markAsProcessed({ teamId, monthKey, prorationId });

      expect(count).toBe(5);
      expect(mockRepository.markAsProcessed).toHaveBeenCalledWith({ teamId, monthKey, prorationId });
    });
  });
});
