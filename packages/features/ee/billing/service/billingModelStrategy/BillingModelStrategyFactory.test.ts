import { beforeEach, describe, expect, it, vi } from "vitest";
import { ActiveUsersBillingStrategy } from "./ActiveUsersBillingStrategy";
import type { BillingModelRecord } from "./BillingModelRepository";
import { BillingModelRepository } from "./BillingModelRepository";
import { getStrategyForSubscription, getStrategyForTeam } from "./BillingModelStrategyFactory";
import { SeatsHwmBillingStrategy } from "./SeatsHwmBillingStrategy";
import { SeatsProrationBillingStrategy } from "./SeatsProrationBillingStrategy";

function createMockRepository() {
  return {
    findBySubscriptionId: vi.fn<(id: string) => Promise<BillingModelRecord | null>>(),
    findByTeamId: vi.fn<(id: number) => Promise<BillingModelRecord | null>>(),
  } as unknown as BillingModelRepository & {
    findBySubscriptionId: ReturnType<typeof vi.fn>;
    findByTeamId: ReturnType<typeof vi.fn>;
  };
}

const createMockLogger = () =>
  ({
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }) as unknown;

describe("BillingModelStrategyFactory", () => {
  let repo: ReturnType<typeof createMockRepository>;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = createMockRepository();
  });

  describe("getStrategyForSubscription", () => {
    it("returns SeatsHwmBillingStrategy for SEATS + MONTHLY", async () => {
      repo.findBySubscriptionId.mockResolvedValue({
        billingModel: "SEATS",
        billingPeriod: "MONTHLY",
      });

      const result = await getStrategyForSubscription("sub_123", repo, createMockLogger() as never);

      expect(result).not.toBeNull();
      expect(result!.strategy).toBeInstanceOf(SeatsHwmBillingStrategy);
      expect(result!.billingModel).toBe("SEATS");
      expect(result!.billingPeriod).toBe("MONTHLY");
    });

    it("returns SeatsProrationBillingStrategy for SEATS + ANNUALLY", async () => {
      repo.findBySubscriptionId.mockResolvedValue({
        billingModel: "SEATS",
        billingPeriod: "ANNUALLY",
      });

      const result = await getStrategyForSubscription("sub_123", repo, createMockLogger() as never);

      expect(result).not.toBeNull();
      expect(result!.strategy).toBeInstanceOf(SeatsProrationBillingStrategy);
      expect(result!.billingModel).toBe("SEATS");
      expect(result!.billingPeriod).toBe("ANNUALLY");
    });

    it("returns SeatsProrationBillingStrategy for SEATS + null billingPeriod", async () => {
      repo.findBySubscriptionId.mockResolvedValue({
        billingModel: "SEATS",
        billingPeriod: null,
      });

      const result = await getStrategyForSubscription("sub_123", repo, createMockLogger() as never);

      expect(result).not.toBeNull();
      expect(result!.strategy).toBeInstanceOf(SeatsProrationBillingStrategy);
    });

    it("returns ActiveUsersBillingStrategy for ACTIVE_USERS", async () => {
      repo.findBySubscriptionId.mockResolvedValue({
        billingModel: "ACTIVE_USERS",
        billingPeriod: "MONTHLY",
      });

      const result = await getStrategyForSubscription("sub_123", repo, createMockLogger() as never);

      expect(result).not.toBeNull();
      expect(result!.strategy).toBeInstanceOf(ActiveUsersBillingStrategy);
      expect(result!.billingModel).toBe("ACTIVE_USERS");
    });

    it("returns null when no billing record exists", async () => {
      repo.findBySubscriptionId.mockResolvedValue(null);

      const mockLog = createMockLogger() as { warn: ReturnType<typeof vi.fn> };
      const result = await getStrategyForSubscription("sub_unknown", repo, mockLog as never);

      expect(result).toBeNull();
      expect(mockLog.warn).toHaveBeenCalledWith("No billing record found for subscription sub_unknown");
    });
  });

  describe("getStrategyForTeam", () => {
    it("returns SeatsHwmBillingStrategy for SEATS + MONTHLY", async () => {
      repo.findByTeamId.mockResolvedValue({
        billingModel: "SEATS",
        billingPeriod: "MONTHLY",
      });

      const result = await getStrategyForTeam(42, repo, createMockLogger() as never);

      expect(result).not.toBeNull();
      expect(result!.strategy).toBeInstanceOf(SeatsHwmBillingStrategy);
      expect(result!.billingModel).toBe("SEATS");
    });

    it("returns ActiveUsersBillingStrategy for ACTIVE_USERS", async () => {
      repo.findByTeamId.mockResolvedValue({
        billingModel: "ACTIVE_USERS",
        billingPeriod: "MONTHLY",
      });

      const result = await getStrategyForTeam(42, repo, createMockLogger() as never);

      expect(result).not.toBeNull();
      expect(result!.strategy).toBeInstanceOf(ActiveUsersBillingStrategy);
    });

    it("returns SeatsProrationBillingStrategy for SEATS + ANNUALLY", async () => {
      repo.findByTeamId.mockResolvedValue({
        billingModel: "SEATS",
        billingPeriod: "ANNUALLY",
      });

      const result = await getStrategyForTeam(99, repo, createMockLogger() as never);

      expect(result).not.toBeNull();
      expect(result!.strategy).toBeInstanceOf(SeatsProrationBillingStrategy);
    });

    it("returns null when no billing record exists for team", async () => {
      repo.findByTeamId.mockResolvedValue(null);

      const mockLog = createMockLogger() as { warn: ReturnType<typeof vi.fn> };
      const result = await getStrategyForTeam(999, repo, mockLog as never);

      expect(result).toBeNull();
      expect(mockLog.warn).toHaveBeenCalledWith("No billing record found for team 999");
    });
  });
});
