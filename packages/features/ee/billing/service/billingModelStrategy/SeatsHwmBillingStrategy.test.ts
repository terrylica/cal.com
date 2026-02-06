import { beforeEach, describe, expect, it, vi } from "vitest";
import { SeatsHwmBillingStrategy } from "./SeatsHwmBillingStrategy";

const mockApplyHighWaterMarkToSubscription = vi.fn();
const mockResetSubscriptionAfterRenewal = vi.fn();

vi.mock("../highWaterMark/HighWaterMarkService", () => ({
  HighWaterMarkService: class MockHighWaterMarkService {
    applyHighWaterMarkToSubscription = mockApplyHighWaterMarkToSubscription;
    resetSubscriptionAfterRenewal = mockResetSubscriptionAfterRenewal;
  },
}));

const mockUpdateQuantity = vi.fn();
const mockFindAndInit = vi.fn(() => Promise.resolve({ updateQuantity: mockUpdateQuantity }));
const mockLogSeatAddition = vi.fn();
const mockLogSeatRemoval = vi.fn();

const createMockLogger = () =>
  ({
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }) as unknown;

function createStrategy() {
  return new SeatsHwmBillingStrategy({
    seatTracker: { logSeatAddition: mockLogSeatAddition, logSeatRemoval: mockLogSeatRemoval } as never,
    billingProviderService: {} as never,
    teamBillingServiceFactory: { findAndInit: mockFindAndInit } as never,
  });
}

describe("SeatsHwmBillingStrategy", () => {
  let strategy: SeatsHwmBillingStrategy;

  beforeEach(() => {
    vi.clearAllMocks();
    strategy = createStrategy();
  });

  describe("handleInvoiceUpcoming", () => {
    it("delegates to HighWaterMarkService.applyHighWaterMarkToSubscription", async () => {
      mockApplyHighWaterMarkToSubscription.mockResolvedValue(true);

      const result = await strategy.handleInvoiceUpcoming(
        { subscriptionId: "sub_123" },
        createMockLogger() as never
      );

      expect(result).toEqual({ applied: true });
      expect(mockApplyHighWaterMarkToSubscription).toHaveBeenCalledWith("sub_123");
    });

    it("returns applied: false when HWM service returns false", async () => {
      mockApplyHighWaterMarkToSubscription.mockResolvedValue(false);

      const result = await strategy.handleInvoiceUpcoming(
        { subscriptionId: "sub_123" },
        createMockLogger() as never
      );

      expect(result).toEqual({ applied: false });
    });
  });

  describe("handlePostRenewalReset", () => {
    it("delegates to HighWaterMarkService.resetSubscriptionAfterRenewal", async () => {
      mockResetSubscriptionAfterRenewal.mockResolvedValue(true);
      const timestamp = 1704067200;

      const result = await strategy.handlePostRenewalReset(
        { subscriptionId: "sub_123", periodStartTimestamp: timestamp },
        createMockLogger() as never
      );

      expect(result).toEqual({ success: true, updated: true });
      expect(mockResetSubscriptionAfterRenewal).toHaveBeenCalledWith({
        subscriptionId: "sub_123",
        newPeriodStart: new Date(timestamp * 1000),
      });
    });

    it("returns success with updated=false when no update needed", async () => {
      mockResetSubscriptionAfterRenewal.mockResolvedValue(false);

      const result = await strategy.handlePostRenewalReset(
        { subscriptionId: "sub_123", periodStartTimestamp: 1704067200 },
        createMockLogger() as never
      );

      expect(result).toEqual({ success: true, updated: false });
    });

    it("returns failure when reset throws an error", async () => {
      mockResetSubscriptionAfterRenewal.mockRejectedValue(new Error("Stripe API error"));
      const mockLog = createMockLogger() as { error: ReturnType<typeof vi.fn> };

      const result = await strategy.handlePostRenewalReset(
        { subscriptionId: "sub_err", periodStartTimestamp: 1704067200 },
        mockLog as never
      );

      expect(result).toEqual({ success: false, error: "Stripe API error" });
      expect(mockLog.error).toHaveBeenCalledWith("Failed to reset HWM after invoice paid", {
        subscriptionId: "sub_err",
        error: "Stripe API error",
      });
    });
  });

  describe("handleMemberAddition", () => {
    it("logs seat addition and updates quantity", async () => {
      mockLogSeatAddition.mockResolvedValue(undefined);
      mockUpdateQuantity.mockResolvedValue(undefined);

      await strategy.handleMemberAddition(
        { teamId: 42, userId: 7, triggeredBy: 1, seatCount: 1 },
        createMockLogger() as never
      );

      expect(mockLogSeatAddition).toHaveBeenCalledWith({
        teamId: 42,
        userId: 7,
        triggeredBy: 1,
        seatCount: 1,
      });
      expect(mockFindAndInit).toHaveBeenCalledWith(42);
      expect(mockUpdateQuantity).toHaveBeenCalledOnce();
    });

    it("logs error but does not throw when updateQuantity fails", async () => {
      mockLogSeatAddition.mockResolvedValue(undefined);
      mockFindAndInit.mockRejectedValueOnce(new Error("Billing not found"));
      const mockLog = createMockLogger() as { error: ReturnType<typeof vi.fn> };

      await expect(
        strategy.handleMemberAddition({ teamId: 42, seatCount: 1 }, mockLog as never)
      ).resolves.toBeUndefined();

      expect(mockLog.error).toHaveBeenCalledWith("Failed to sync billing quantity", {
        teamId: 42,
        error: "Billing not found",
      });
    });
  });

  describe("handleMemberRemoval", () => {
    it("logs seat removal and updates quantity", async () => {
      mockLogSeatRemoval.mockResolvedValue(undefined);
      mockUpdateQuantity.mockResolvedValue(undefined);

      await strategy.handleMemberRemoval(
        { teamId: 42, userId: 7, triggeredBy: 1, seatCount: 1 },
        createMockLogger() as never
      );

      expect(mockLogSeatRemoval).toHaveBeenCalledWith({
        teamId: 42,
        userId: 7,
        triggeredBy: 1,
        seatCount: 1,
      });
      expect(mockFindAndInit).toHaveBeenCalledWith(42);
      expect(mockUpdateQuantity).toHaveBeenCalledOnce();
    });
  });

  describe("syncBillingQuantity", () => {
    it("updates quantity without logging seat changes", async () => {
      mockUpdateQuantity.mockResolvedValue(undefined);

      await strategy.syncBillingQuantity({ teamId: 42 }, createMockLogger() as never);

      expect(mockFindAndInit).toHaveBeenCalledWith(42);
      expect(mockUpdateQuantity).toHaveBeenCalledOnce();
      expect(mockLogSeatAddition).not.toHaveBeenCalled();
      expect(mockLogSeatRemoval).not.toHaveBeenCalled();
    });

    it("logs error but does not throw when updateQuantity fails", async () => {
      mockFindAndInit.mockRejectedValueOnce(new Error("Billing not found"));
      const mockLog = createMockLogger() as { error: ReturnType<typeof vi.fn> };

      await expect(
        strategy.syncBillingQuantity({ teamId: 42 }, mockLog as never)
      ).resolves.toBeUndefined();

      expect(mockLog.error).toHaveBeenCalledWith("Failed to sync billing quantity", {
        teamId: 42,
        error: "Billing not found",
      });
    });
  });
});
