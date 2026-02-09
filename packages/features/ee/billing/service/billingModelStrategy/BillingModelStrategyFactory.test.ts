import { beforeEach, describe, expect, it, vi } from "vitest";
import { ActiveUsersBillingStrategy } from "./ActiveUsersBillingStrategy";
import type { BillingModelRecord } from "./BillingModelRepository";
import { getStrategyForSubscription, getStrategyForTeam } from "./BillingModelStrategyFactory";
import { SeatsHwmBillingStrategy } from "./SeatsHwmBillingStrategy";
import { SeatsProrationBillingStrategy } from "./SeatsProrationBillingStrategy";

const mockFindBySubscriptionId = vi.fn<(id: string) => Promise<BillingModelRecord | null>>();
const mockFindByTeamId = vi.fn<(id: number) => Promise<BillingModelRecord | null>>();

vi.mock("../../di/containers/Billing", () => ({
  getBillingModelRepository: () => ({
    findBySubscriptionId: mockFindBySubscriptionId,
    findByTeamId: mockFindByTeamId,
  }),
}));

const createMockLogger = () =>
  ({
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }) as unknown;

describe("BillingModelStrategyFactory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getStrategyForSubscription", () => {
    it("returns SeatsHwmBillingStrategy for SEATS + MONTHLY", async () => {
      mockFindBySubscriptionId.mockResolvedValue({
        billingModel: "SEATS",
        billingPeriod: "MONTHLY",
      });

      const result = await getStrategyForSubscription("sub_123", createMockLogger() as never);

      expect(result).not.toBeNull();
      expect(result!.strategy).toBeInstanceOf(SeatsHwmBillingStrategy);
      expect(result!.billingModel).toBe("SEATS");
      expect(result!.billingPeriod).toBe("MONTHLY");
    });

    it("returns SeatsProrationBillingStrategy for SEATS + ANNUALLY", async () => {
      mockFindBySubscriptionId.mockResolvedValue({
        billingModel: "SEATS",
        billingPeriod: "ANNUALLY",
      });

      const result = await getStrategyForSubscription("sub_123", createMockLogger() as never);

      expect(result).not.toBeNull();
      expect(result!.strategy).toBeInstanceOf(SeatsProrationBillingStrategy);
      expect(result!.billingModel).toBe("SEATS");
      expect(result!.billingPeriod).toBe("ANNUALLY");
    });

    it("returns SeatsProrationBillingStrategy for SEATS + null billingPeriod", async () => {
      mockFindBySubscriptionId.mockResolvedValue({
        billingModel: "SEATS",
        billingPeriod: null,
      });

      const result = await getStrategyForSubscription("sub_123", createMockLogger() as never);

      expect(result).not.toBeNull();
      expect(result!.strategy).toBeInstanceOf(SeatsProrationBillingStrategy);
    });

    it("returns ActiveUsersBillingStrategy for ACTIVE_USERS", async () => {
      mockFindBySubscriptionId.mockResolvedValue({
        billingModel: "ACTIVE_USERS",
        billingPeriod: "MONTHLY",
      });

      const result = await getStrategyForSubscription("sub_123", createMockLogger() as never);

      expect(result).not.toBeNull();
      expect(result!.strategy).toBeInstanceOf(ActiveUsersBillingStrategy);
      expect(result!.billingModel).toBe("ACTIVE_USERS");
    });

    it("returns null when no billing record exists", async () => {
      mockFindBySubscriptionId.mockResolvedValue(null);

      const mockLog = createMockLogger() as { warn: ReturnType<typeof vi.fn> };
      const result = await getStrategyForSubscription("sub_unknown", mockLog as never);

      expect(result).toBeNull();
      expect(mockLog.warn).toHaveBeenCalledWith("No billing record found for subscription sub_unknown");
    });
  });

  describe("getStrategyForTeam", () => {
    it("returns SeatsHwmBillingStrategy for SEATS + MONTHLY", async () => {
      mockFindByTeamId.mockResolvedValue({
        billingModel: "SEATS",
        billingPeriod: "MONTHLY",
      });

      const result = await getStrategyForTeam(42, createMockLogger() as never);

      expect(result).not.toBeNull();
      expect(result!.strategy).toBeInstanceOf(SeatsHwmBillingStrategy);
      expect(result!.billingModel).toBe("SEATS");
    });

    it("returns ActiveUsersBillingStrategy for ACTIVE_USERS", async () => {
      mockFindByTeamId.mockResolvedValue({
        billingModel: "ACTIVE_USERS",
        billingPeriod: "MONTHLY",
      });

      const result = await getStrategyForTeam(42, createMockLogger() as never);

      expect(result).not.toBeNull();
      expect(result!.strategy).toBeInstanceOf(ActiveUsersBillingStrategy);
    });

    it("returns SeatsProrationBillingStrategy for SEATS + ANNUALLY", async () => {
      mockFindByTeamId.mockResolvedValue({
        billingModel: "SEATS",
        billingPeriod: "ANNUALLY",
      });

      const result = await getStrategyForTeam(99, createMockLogger() as never);

      expect(result).not.toBeNull();
      expect(result!.strategy).toBeInstanceOf(SeatsProrationBillingStrategy);
    });

    it("returns null when no billing record exists for team", async () => {
      mockFindByTeamId.mockResolvedValue(null);

      const mockLog = createMockLogger() as { warn: ReturnType<typeof vi.fn> };
      const result = await getStrategyForTeam(999, mockLog as never);

      expect(result).toBeNull();
      expect(mockLog.warn).toHaveBeenCalledWith("No billing record found for team 999");
    });
  });
});
