import { beforeEach, describe, expect, it, vi } from "vitest";
import { ActiveUsersBillingStrategy } from "./ActiveUsersBillingStrategy";

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
  return new ActiveUsersBillingStrategy({
    logSeatAddition: mockLogSeatAddition,
    logSeatRemoval: mockLogSeatRemoval,
  } as never);
}

describe("ActiveUsersBillingStrategy", () => {
  let strategy: ActiveUsersBillingStrategy;

  beforeEach(() => {
    vi.clearAllMocks();
    strategy = createStrategy();
  });

  describe("handleInvoiceUpcoming", () => {
    it("returns applied: false (no-op)", async () => {
      const result = await strategy.handleInvoiceUpcoming(
        { subscriptionId: "sub_123" },
        createMockLogger() as never
      );
      expect(result).toEqual({ applied: false });
    });
  });

  describe("handlePostRenewalReset", () => {
    it("returns success with no update (no-op)", async () => {
      const result = await strategy.handlePostRenewalReset(
        { subscriptionId: "sub_123", periodStartTimestamp: 1704067200 },
        createMockLogger() as never
      );
      expect(result).toEqual({ success: true, updated: false });
    });
  });

  describe("handleMemberAddition", () => {
    it("logs seat addition for audit but does not update billing", async () => {
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
    it("logs seat removal for audit but does not update billing", async () => {
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
    it("is a no-op", async () => {
      await strategy.syncBillingQuantity({ teamId: 42 }, createMockLogger() as never);

      expect(mockLogSeatAddition).not.toHaveBeenCalled();
      expect(mockLogSeatRemoval).not.toHaveBeenCalled();
    });
  });
});
