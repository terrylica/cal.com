import type { IFeaturesRepository } from "@calcom/features/flags/features.repository.interface";
import logger from "@calcom/lib/logger";

import type { BillingPeriodService } from "../billingPeriod/BillingPeriodService";
import type { IBillingProviderService } from "../billingProvider/IBillingProviderService";
import type { HighWaterMarkService } from "../highWaterMark/HighWaterMarkService";
import type { MonthlyProrationService } from "../proration/MonthlyProrationService";
import type { HighWaterMarkRepository } from "../../repository/highWaterMark/HighWaterMarkRepository";
import { HighWaterMarkStrategy } from "./HighWaterMarkStrategy";
import { ImmediateUpdateStrategy } from "./ImmediateUpdateStrategy";
import type { ISeatBillingStrategy } from "./ISeatBillingStrategy";
import { MonthlyProrationStrategy } from "./MonthlyProrationStrategy";

const log = logger.getSubLogger({ prefix: ["SeatBillingStrategyFactory"] });

export interface ISeatBillingStrategyFactoryDeps {
  billingPeriodService: BillingPeriodService;
  featuresRepository: IFeaturesRepository;
  billingProviderService: IBillingProviderService;
  highWaterMarkRepository: HighWaterMarkRepository;
  highWaterMarkService: HighWaterMarkService;
  monthlyProrationService: MonthlyProrationService;
}

export class SeatBillingStrategyFactory {
  private readonly prorationStrategy: ISeatBillingStrategy;
  private readonly hwmStrategy: ISeatBillingStrategy;
  private readonly fallback: ISeatBillingStrategy;

  constructor(private readonly deps: ISeatBillingStrategyFactoryDeps) {
    this.fallback = new ImmediateUpdateStrategy(deps.billingProviderService);
    this.prorationStrategy = new MonthlyProrationStrategy({
      monthlyProrationService: deps.monthlyProrationService,
    });
    this.hwmStrategy = new HighWaterMarkStrategy({
      highWaterMarkRepository: deps.highWaterMarkRepository,
      highWaterMarkService: deps.highWaterMarkService,
    });
  }

  async create(teamId: number): Promise<ISeatBillingStrategy> {
    const info = await this.deps.billingPeriodService.getBillingPeriodInfo(teamId);

    if (!info.isInTrial && info.subscriptionStart) {
      if (info.billingPeriod === "ANNUALLY") {
        const enabled = await this.deps.featuresRepository.checkIfFeatureIsEnabledGlobally("monthly-proration");
        if (enabled) return this.prorationStrategy;
      }
      if (info.billingPeriod === "MONTHLY") {
        const enabled = await this.deps.featuresRepository.checkIfFeatureIsEnabledGlobally("hwm-seating");
        if (enabled) return this.hwmStrategy;
      }
    }

    return this.fallback;
  }

  async createBySubscriptionId(subscriptionId: string): Promise<ISeatBillingStrategy> {
    const billing = await this.deps.highWaterMarkRepository.getBySubscriptionId(subscriptionId);
    if (!billing) {
      log.warn(`No billing record found for subscription ${subscriptionId}, using fallback strategy`);
      return this.fallback;
    }
    return this.create(billing.teamId);
  }
}
