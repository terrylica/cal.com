import type { IFeaturesRepository } from "@calcom/features/flags/features.repository.interface";
import { describe, expect, it, vi } from "vitest";
import type { BillingPeriodInfo } from "../../billingPeriod/BillingPeriodService";
import type { IBillingProviderService } from "../../billingProvider/IBillingProviderService";
import { HighWaterMarkStrategy } from "../HighWaterMarkStrategy";
import { ImmediateUpdateStrategy } from "../ImmediateUpdateStrategy";
import { MonthlyProrationStrategy } from "../MonthlyProrationStrategy";
import { SeatBillingStrategyResolver } from "../SeatBillingStrategyResolver";

function createMockBillingPeriodService(info: BillingPeriodInfo) {
  return { getBillingPeriodInfo: vi.fn().mockResolvedValue(info) };
}

function createMockFeaturesRepository(enabledFlags: Record<string, boolean>): IFeaturesRepository {
  return {
    checkIfFeatureIsEnabledGlobally: vi.fn(async (slug: string) => enabledFlags[slug] ?? false),
  } as unknown as IFeaturesRepository;
}

function createMockBillingProviderService(): IBillingProviderService {
  return { handleSubscriptionUpdate: vi.fn() } as unknown as IBillingProviderService;
}

function createMockHighWaterMarkRepository() {
  return {
    getByTeamId: vi.fn(),
    getBySubscriptionId: vi.fn(),
    updateIfHigher: vi.fn().mockResolvedValue({ updated: false, previousHighWaterMark: null }),
  };
}

function createMockHighWaterMarkService() {
  return {
    applyHighWaterMarkToSubscription: vi.fn().mockResolvedValue(false),
    resetSubscriptionAfterRenewal: vi.fn().mockResolvedValue(false),
  };
}

const baseBillingInfo: BillingPeriodInfo = {
  billingPeriod: null,
  subscriptionStart: new Date("2025-01-01"),
  subscriptionEnd: new Date("2026-01-01"),
  trialEnd: null,
  isInTrial: false,
  pricePerSeat: 1500,
  isOrganization: false,
};

function createResolver(
  info: BillingPeriodInfo,
  enabledFlags: Record<string, boolean>,
  overrides?: { highWaterMarkRepository?: ReturnType<typeof createMockHighWaterMarkRepository> }
): SeatBillingStrategyResolver {
  return new SeatBillingStrategyResolver({
    billingPeriodService: createMockBillingPeriodService(info),
    featuresRepository: createMockFeaturesRepository(enabledFlags),
    billingProviderService: createMockBillingProviderService(),
    highWaterMarkRepository: overrides?.highWaterMarkRepository ?? createMockHighWaterMarkRepository(),
    highWaterMarkService: createMockHighWaterMarkService(),
  } as never);
}

describe("SeatBillingStrategyResolver", () => {
  it("returns MonthlyProrationStrategy for annual plan with proration enabled", async () => {
    const billingPeriodService = createMockBillingPeriodService({
      ...baseBillingInfo,
      billingPeriod: "ANNUALLY",
    });
    const resolver = new SeatBillingStrategyResolver({
      billingPeriodService,
      featuresRepository: createMockFeaturesRepository({ "monthly-proration": true }),
      billingProviderService: createMockBillingProviderService(),
      highWaterMarkRepository: createMockHighWaterMarkRepository(),
      highWaterMarkService: createMockHighWaterMarkService(),
    } as never);
    const strategy = await resolver.resolve(1);

    expect(strategy).toBeInstanceOf(MonthlyProrationStrategy);
    expect(billingPeriodService.getBillingPeriodInfo).toHaveBeenCalledWith(1);
  });

  it("returns HighWaterMarkStrategy for monthly plan with HWM enabled", async () => {
    const resolver = createResolver(
      { ...baseBillingInfo, billingPeriod: "MONTHLY" },
      { "hwm-seating": true }
    );
    const strategy = await resolver.resolve(1);

    expect(strategy).toBeInstanceOf(HighWaterMarkStrategy);
  });

  it("returns ImmediateUpdateStrategy for annual plan with proration disabled", async () => {
    const resolver = createResolver(
      { ...baseBillingInfo, billingPeriod: "ANNUALLY" },
      { "monthly-proration": false }
    );
    const strategy = await resolver.resolve(1);

    expect(strategy).toBeInstanceOf(ImmediateUpdateStrategy);
  });

  it("returns ImmediateUpdateStrategy for monthly plan with HWM disabled", async () => {
    const resolver = createResolver(
      { ...baseBillingInfo, billingPeriod: "MONTHLY" },
      { "hwm-seating": false }
    );
    const strategy = await resolver.resolve(1);

    expect(strategy).toBeInstanceOf(ImmediateUpdateStrategy);
  });

  it("returns ImmediateUpdateStrategy when team is in trial", async () => {
    const resolver = createResolver(
      { ...baseBillingInfo, billingPeriod: "ANNUALLY", isInTrial: true, trialEnd: new Date("2026-06-01") },
      { "monthly-proration": true }
    );
    const strategy = await resolver.resolve(1);

    expect(strategy).toBeInstanceOf(ImmediateUpdateStrategy);
  });

  it("returns ImmediateUpdateStrategy when subscriptionStart is null", async () => {
    const resolver = createResolver(
      { ...baseBillingInfo, billingPeriod: "ANNUALLY", subscriptionStart: null },
      { "monthly-proration": true }
    );
    const strategy = await resolver.resolve(1);

    expect(strategy).toBeInstanceOf(ImmediateUpdateStrategy);
  });

  it("returns ImmediateUpdateStrategy when billingPeriod is null", async () => {
    const resolver = createResolver(
      { ...baseBillingInfo, billingPeriod: null },
      { "monthly-proration": true, "hwm-seating": true }
    );
    const strategy = await resolver.resolve(1);

    expect(strategy).toBeInstanceOf(ImmediateUpdateStrategy);
  });

  it("resolveBySubscriptionId looks up teamId and delegates to resolve", async () => {
    const hwmRepo = createMockHighWaterMarkRepository();
    hwmRepo.getBySubscriptionId.mockResolvedValue({ teamId: 42 });

    const resolver = createResolver(
      { ...baseBillingInfo, billingPeriod: "MONTHLY" },
      { "hwm-seating": true },
      { highWaterMarkRepository: hwmRepo }
    );
    const strategy = await resolver.resolveBySubscriptionId("sub_abc");

    expect(hwmRepo.getBySubscriptionId).toHaveBeenCalledWith("sub_abc");
    expect(strategy).toBeInstanceOf(HighWaterMarkStrategy);
  });

  it("resolveBySubscriptionId returns fallback when no billing record found", async () => {
    const hwmRepo = createMockHighWaterMarkRepository();
    hwmRepo.getBySubscriptionId.mockResolvedValue(null);

    const resolver = createResolver(baseBillingInfo, {}, { highWaterMarkRepository: hwmRepo });
    const strategy = await resolver.resolveBySubscriptionId("sub_unknown");

    expect(strategy).toBeInstanceOf(ImmediateUpdateStrategy);
  });
});
