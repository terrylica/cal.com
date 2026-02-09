import type { IFeaturesRepository } from "@calcom/features/flags/features.repository.interface";

import type { BillingPeriodService } from "../billingPeriod/BillingPeriodService";
import type { IBillingProviderService } from "../billingProvider/IBillingProviderService";
import { HighWaterMarkStrategy } from "./HighWaterMarkStrategy";
import { ImmediateUpdateStrategy } from "./ImmediateUpdateStrategy";
import type { ISeatBillingStrategy } from "./ISeatBillingStrategy";
import { MonthlyProrationStrategy } from "./MonthlyProrationStrategy";

export interface ISeatBillingStrategyResolverDeps {
  billingPeriodService: BillingPeriodService;
  featuresRepository: IFeaturesRepository;
  billingProviderService: IBillingProviderService;
}

export class SeatBillingStrategyResolver {
  private readonly strategies: ISeatBillingStrategy[];

  constructor(private readonly deps: ISeatBillingStrategyResolverDeps) {
    this.strategies = [
      new MonthlyProrationStrategy(deps.featuresRepository),
      new HighWaterMarkStrategy(deps.featuresRepository),
      new ImmediateUpdateStrategy(deps.billingProviderService),
    ];
  }

  async resolve(teamId: number): Promise<ISeatBillingStrategy> {
    const info = await this.deps.billingPeriodService.getBillingPeriodInfo(teamId);

    for (const strategy of this.strategies) {
      if (await strategy.canHandle(info)) {
        return strategy;
      }
    }

    return new ImmediateUpdateStrategy(this.deps.billingProviderService);
  }
}
