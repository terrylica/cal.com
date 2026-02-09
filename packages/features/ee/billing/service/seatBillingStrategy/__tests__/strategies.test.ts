import type { IFeaturesRepository } from "@calcom/features/flags/features.repository.interface";
import { describe, expect, it, vi } from "vitest";
import type { BillingPeriodInfo } from "../../billingPeriod/BillingPeriodService";
import type { IBillingProviderService } from "../../billingProvider/IBillingProviderService";
import { HighWaterMarkStrategy } from "../HighWaterMarkStrategy";
import { ImmediateUpdateStrategy } from "../ImmediateUpdateStrategy";
import type { SeatChangeContext } from "../ISeatBillingStrategy";
import { MonthlyProrationStrategy } from "../MonthlyProrationStrategy";

const mockContext: SeatChangeContext = {
  teamId: 1,
  subscriptionId: "sub_123",
  subscriptionItemId: "si_456",
  membershipCount: 10,
  changeType: "addition",
};

const baseBillingInfo: BillingPeriodInfo = {
  billingPeriod: null,
  subscriptionStart: new Date("2025-01-01"),
  subscriptionEnd: new Date("2026-01-01"),
  trialEnd: null,
  isInTrial: false,
  pricePerSeat: 1500,
  isOrganization: false,
};

function createMockFeaturesRepository(enabledFlags: Record<string, boolean>): IFeaturesRepository {
  return {
    checkIfFeatureIsEnabledGlobally: vi.fn(async (slug: string) => enabledFlags[slug] ?? false),
  } as unknown as IFeaturesRepository;
}

function createMockBillingProviderService(): IBillingProviderService {
  return {
    handleSubscriptionUpdate: vi.fn(),
  } as unknown as IBillingProviderService;
}

describe("ImmediateUpdateStrategy", () => {
  it("canHandle always returns true", async () => {
    const billingProvider = createMockBillingProviderService();
    const strategy = new ImmediateUpdateStrategy(billingProvider);
    expect(await strategy.canHandle(baseBillingInfo)).toBe(true);
    expect(await strategy.canHandle({ ...baseBillingInfo, isInTrial: true })).toBe(true);
    expect(await strategy.canHandle({ ...baseBillingInfo, billingPeriod: "ANNUALLY" })).toBe(true);
  });

  it("calls handleSubscriptionUpdate on seat change", async () => {
    const billingProvider = createMockBillingProviderService();
    const strategy = new ImmediateUpdateStrategy(billingProvider);

    await strategy.onSeatChange(mockContext);

    expect(billingProvider.handleSubscriptionUpdate).toHaveBeenCalledWith({
      subscriptionId: "sub_123",
      subscriptionItemId: "si_456",
      membershipCount: 10,
    });
  });
});

describe("HighWaterMarkStrategy", () => {
  it("canHandle returns true for monthly plan with HWM flag enabled", async () => {
    const featuresRepo = createMockFeaturesRepository({ "hwm-seating": true });
    const strategy = new HighWaterMarkStrategy(featuresRepo);

    expect(await strategy.canHandle({ ...baseBillingInfo, billingPeriod: "MONTHLY" })).toBe(true);
  });

  it("canHandle returns false when billing period is not MONTHLY", async () => {
    const featuresRepo = createMockFeaturesRepository({ "hwm-seating": true });
    const strategy = new HighWaterMarkStrategy(featuresRepo);

    expect(await strategy.canHandle({ ...baseBillingInfo, billingPeriod: "ANNUALLY" })).toBe(false);
    expect(await strategy.canHandle({ ...baseBillingInfo, billingPeriod: null })).toBe(false);
  });

  it("canHandle returns false when HWM flag is disabled", async () => {
    const featuresRepo = createMockFeaturesRepository({ "hwm-seating": false });
    const strategy = new HighWaterMarkStrategy(featuresRepo);

    expect(await strategy.canHandle({ ...baseBillingInfo, billingPeriod: "MONTHLY" })).toBe(false);
  });

  it("canHandle returns false when team is in trial", async () => {
    const featuresRepo = createMockFeaturesRepository({ "hwm-seating": true });
    const strategy = new HighWaterMarkStrategy(featuresRepo);

    expect(
      await strategy.canHandle({ ...baseBillingInfo, billingPeriod: "MONTHLY", isInTrial: true })
    ).toBe(false);
    expect(featuresRepo.checkIfFeatureIsEnabledGlobally).not.toHaveBeenCalled();
  });

  it("canHandle returns false when subscriptionStart is null", async () => {
    const featuresRepo = createMockFeaturesRepository({ "hwm-seating": true });
    const strategy = new HighWaterMarkStrategy(featuresRepo);

    expect(
      await strategy.canHandle({ ...baseBillingInfo, billingPeriod: "MONTHLY", subscriptionStart: null })
    ).toBe(false);
    expect(featuresRepo.checkIfFeatureIsEnabledGlobally).not.toHaveBeenCalled();
  });

  it("does not call any external service on seat change", async () => {
    const featuresRepo = createMockFeaturesRepository({ "hwm-seating": true });
    const strategy = new HighWaterMarkStrategy(featuresRepo);

    await expect(strategy.onSeatChange(mockContext)).resolves.toBeUndefined();
  });
});

describe("MonthlyProrationStrategy", () => {
  it("canHandle returns true for annual plan with proration flag enabled", async () => {
    const featuresRepo = createMockFeaturesRepository({ "monthly-proration": true });
    const strategy = new MonthlyProrationStrategy(featuresRepo);

    expect(await strategy.canHandle({ ...baseBillingInfo, billingPeriod: "ANNUALLY" })).toBe(true);
  });

  it("canHandle returns false when billing period is not ANNUALLY", async () => {
    const featuresRepo = createMockFeaturesRepository({ "monthly-proration": true });
    const strategy = new MonthlyProrationStrategy(featuresRepo);

    expect(await strategy.canHandle({ ...baseBillingInfo, billingPeriod: "MONTHLY" })).toBe(false);
    expect(await strategy.canHandle({ ...baseBillingInfo, billingPeriod: null })).toBe(false);
  });

  it("canHandle returns false when proration flag is disabled", async () => {
    const featuresRepo = createMockFeaturesRepository({ "monthly-proration": false });
    const strategy = new MonthlyProrationStrategy(featuresRepo);

    expect(await strategy.canHandle({ ...baseBillingInfo, billingPeriod: "ANNUALLY" })).toBe(false);
  });

  it("canHandle returns false when team is in trial", async () => {
    const featuresRepo = createMockFeaturesRepository({ "monthly-proration": true });
    const strategy = new MonthlyProrationStrategy(featuresRepo);

    expect(
      await strategy.canHandle({ ...baseBillingInfo, billingPeriod: "ANNUALLY", isInTrial: true })
    ).toBe(false);
    expect(featuresRepo.checkIfFeatureIsEnabledGlobally).not.toHaveBeenCalled();
  });

  it("canHandle returns false when subscriptionStart is null", async () => {
    const featuresRepo = createMockFeaturesRepository({ "monthly-proration": true });
    const strategy = new MonthlyProrationStrategy(featuresRepo);

    expect(
      await strategy.canHandle({ ...baseBillingInfo, billingPeriod: "ANNUALLY", subscriptionStart: null })
    ).toBe(false);
    expect(featuresRepo.checkIfFeatureIsEnabledGlobally).not.toHaveBeenCalled();
  });

  it("does not call any external service on seat change", async () => {
    const featuresRepo = createMockFeaturesRepository({ "monthly-proration": true });
    const strategy = new MonthlyProrationStrategy(featuresRepo);

    await expect(strategy.onSeatChange(mockContext)).resolves.toBeUndefined();
  });
});
