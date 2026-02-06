import { beforeEach, describe, expect, it, vi } from "vitest";
import { SeatsProrationBillingStrategy } from "./SeatsProrationBillingStrategy";

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
  return new SeatsProrationBillingStrategy({
    seatTracker: { logSeatAddition: mockLogSeatAddition, logSeatRemoval: mockLogSeatRemoval } as never,
  });
}

describe("SeatsProrationBillingStrategy", () => {
  let strategy: SeatsProrationBillingStrategy;

  beforeEach(() => {
    vi.clearAllMocks();
    strategy = createStrategy();
  });

  describe("handleInvoiceUpcoming", () => {
    it("returns applied: false (no-op for annual)", async () => {
      const result = await strategy.handleInvoiceUpcoming(
        { subscriptionId: "sub_123" },
        createMockLogger() as never
      );
      expect(result).toEqual({ applied: false });
    });
  });

  describe("handlePostRenewalReset", () => {
    it("returns success with no update (no-op for annual)", async () => {
      const result = await strategy.handlePostRenewalReset(
        { subscriptionId: "sub_123", periodStartTimestamp: 1704067200 },
        createMockLogger() as never
      );
      expect(result).toEqual({ success: true, updated: false });
    });
  });

  describe("handleMemberAddition", () => {
    it("logs seat addition but does not sync Stripe quantity", async () => {
      mockLogSeatAddition.mockResolvedValue(undefined);

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
    });
  });

  describe("handleMemberRemoval", () => {
    it("logs seat removal but does not sync Stripe quantity", async () => {
      mockLogSeatRemoval.mockResolvedValue(undefined);

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
    });
  });

  describe("syncBillingQuantity", () => {
    it("is a no-op (Stripe sync deferred to MonthlyProrationService)", async () => {
      await strategy.syncBillingQuantity({ teamId: 42 }, createMockLogger() as never);

      expect(mockLogSeatAddition).not.toHaveBeenCalled();
      expect(mockLogSeatRemoval).not.toHaveBeenCalled();
    });
  });
});
