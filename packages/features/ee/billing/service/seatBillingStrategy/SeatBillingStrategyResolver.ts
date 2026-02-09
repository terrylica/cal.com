import type { IFeaturesRepository } from "@calcom/features/flags/features.repository.interface";
import logger from "@calcom/lib/logger";

import type { BillingPeriodService } from "../billingPeriod/BillingPeriodService";
import type { IBillingProviderService } from "../billingProvider/IBillingProviderService";
import type { HighWaterMarkService } from "../highWaterMark/HighWaterMarkService";
import type { HighWaterMarkRepository } from "../../repository/highWaterMark/HighWaterMarkRepository";
import { HighWaterMarkStrategy } from "./HighWaterMarkStrategy";
import { ImmediateUpdateStrategy } from "./ImmediateUpdateStrategy";
import type { ISeatBillingStrategy } from "./ISeatBillingStrategy";
import { MonthlyProrationStrategy } from "./MonthlyProrationStrategy";

const log = logger.getSubLogger({ prefix: ["SeatBillingStrategyResolver"] });

export interface ISeatBillingStrategyResolverDeps {
  billingPeriodService: BillingPeriodService;
  featuresRepository: IFeaturesRepository;
  billingProviderService: IBillingProviderService;
  highWaterMarkRepository: HighWaterMarkRepository;
  highWaterMarkService: HighWaterMarkService;
}

export class SeatBillingStrategyResolver {
  private readonly strategies: ISeatBillingStrategy[];
  private readonly fallback: ISeatBillingStrategy;

  constructor(private readonly deps: ISeatBillingStrategyResolverDeps) {
    this.fallback = new ImmediateUpdateStrategy(deps.billingProviderService);
    this.strategies = [
      new MonthlyProrationStrategy(deps.featuresRepository),
      new HighWaterMarkStrategy({
        featuresRepository: deps.featuresRepository,
        highWaterMarkRepository: deps.highWaterMarkRepository,
        highWaterMarkService: deps.highWaterMarkService,
      }),
      this.fallback,
    ];
  }

  async resolve(teamId: number): Promise<ISeatBillingStrategy> {
    const info = await this.deps.billingPeriodService.getBillingPeriodInfo(teamId);

    for (const strategy of this.strategies) {
      if (await strategy.canHandle(info)) {
        return strategy;
      }
    }

    return this.fallback;
  }

  async resolveBySubscriptionId(subscriptionId: string): Promise<ISeatBillingStrategy> {
    const billing = await this.deps.highWaterMarkRepository.getBySubscriptionId(subscriptionId);
    if (!billing) {
      log.warn(`No billing record found for subscription ${subscriptionId}, using fallback strategy`);
      return this.fallback;
    }
    return this.resolve(billing.teamId);
  }
}
