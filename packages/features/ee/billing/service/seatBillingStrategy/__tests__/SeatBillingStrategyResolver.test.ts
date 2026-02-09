import type { IFeaturesRepository } from "@calcom/features/flags/features.repository.interface";
import { describe, expect, it, vi } from "vitest";
import type { BillingPeriodInfo } from "../../billingPeriod/BillingPeriodService";
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

const baseBillingInfo: BillingPeriodInfo = {
  billingPeriod: null,
  subscriptionStart: new Date("2025-01-01"),
  subscriptionEnd: new Date("2026-01-01"),
  trialEnd: null,
  isInTrial: false,
  pricePerSeat: 1500,
  isOrganization: false,
};

describe("SeatBillingStrategyResolver", () => {
  it("returns MonthlyProrationStrategy for annual plan with proration enabled", async () => {
    const billingPeriodService = createMockBillingPeriodService({
      ...baseBillingInfo,
      billingPeriod: "ANNUALLY",
    });
    const featuresRepository = createMockFeaturesRepository({ "monthly-proration": true });

    const resolver = new SeatBillingStrategyResolver({ billingPeriodService, featuresRepository } as never);
    const strategy = await resolver.resolve(1);

    expect(strategy).toBeInstanceOf(MonthlyProrationStrategy);
    expect(billingPeriodService.getBillingPeriodInfo).toHaveBeenCalledWith(1);
  });

  it("returns HighWaterMarkStrategy for monthly plan with HWM enabled", async () => {
    const billingPeriodService = createMockBillingPeriodService({
      ...baseBillingInfo,
      billingPeriod: "MONTHLY",
    });
    const featuresRepository = createMockFeaturesRepository({ "hwm-seating": true });

    const resolver = new SeatBillingStrategyResolver({ billingPeriodService, featuresRepository } as never);
    const strategy = await resolver.resolve(1);

    expect(strategy).toBeInstanceOf(HighWaterMarkStrategy);
  });

  it("returns ImmediateUpdateStrategy for annual plan with proration disabled", async () => {
    const billingPeriodService = createMockBillingPeriodService({
      ...baseBillingInfo,
      billingPeriod: "ANNUALLY",
    });
    const featuresRepository = createMockFeaturesRepository({ "monthly-proration": false });

    const resolver = new SeatBillingStrategyResolver({ billingPeriodService, featuresRepository } as never);
    const strategy = await resolver.resolve(1);

    expect(strategy).toBeInstanceOf(ImmediateUpdateStrategy);
  });

  it("returns ImmediateUpdateStrategy for monthly plan with HWM disabled", async () => {
    const billingPeriodService = createMockBillingPeriodService({
      ...baseBillingInfo,
      billingPeriod: "MONTHLY",
    });
    const featuresRepository = createMockFeaturesRepository({ "hwm-seating": false });

    const resolver = new SeatBillingStrategyResolver({ billingPeriodService, featuresRepository } as never);
    const strategy = await resolver.resolve(1);

    expect(strategy).toBeInstanceOf(ImmediateUpdateStrategy);
  });

  it("returns ImmediateUpdateStrategy when team is in trial", async () => {
    const billingPeriodService = createMockBillingPeriodService({
      ...baseBillingInfo,
      billingPeriod: "ANNUALLY",
      isInTrial: true,
      trialEnd: new Date("2026-06-01"),
    });
    const featuresRepository = createMockFeaturesRepository({ "monthly-proration": true });

    const resolver = new SeatBillingStrategyResolver({ billingPeriodService, featuresRepository } as never);
    const strategy = await resolver.resolve(1);

    expect(strategy).toBeInstanceOf(ImmediateUpdateStrategy);
  });

  it("returns ImmediateUpdateStrategy when subscriptionStart is null", async () => {
    const billingPeriodService = createMockBillingPeriodService({
      ...baseBillingInfo,
      billingPeriod: "ANNUALLY",
      subscriptionStart: null,
    });
    const featuresRepository = createMockFeaturesRepository({ "monthly-proration": true });

    const resolver = new SeatBillingStrategyResolver({ billingPeriodService, featuresRepository } as never);
    const strategy = await resolver.resolve(1);

    expect(strategy).toBeInstanceOf(ImmediateUpdateStrategy);
  });

  it("returns ImmediateUpdateStrategy when billingPeriod is null", async () => {
    const billingPeriodService = createMockBillingPeriodService({
      ...baseBillingInfo,
      billingPeriod: null,
    });
    const featuresRepository = createMockFeaturesRepository({
      "monthly-proration": true,
      "hwm-seating": true,
    });

    const resolver = new SeatBillingStrategyResolver({ billingPeriodService, featuresRepository } as never);
    const strategy = await resolver.resolve(1);

    expect(strategy).toBeInstanceOf(ImmediateUpdateStrategy);
  });
});
