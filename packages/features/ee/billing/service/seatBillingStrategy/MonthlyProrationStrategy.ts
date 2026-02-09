import type { IFeaturesRepository } from "@calcom/features/flags/features.repository.interface";

import type { BillingPeriodInfo } from "../billingPeriod/BillingPeriodService";
import type { ISeatBillingStrategy, SeatChangeContext } from "./ISeatBillingStrategy";

export class MonthlyProrationStrategy implements ISeatBillingStrategy {
  constructor(private readonly featuresRepository: IFeaturesRepository) {}

  async canHandle(info: BillingPeriodInfo): Promise<boolean> {
    if (info.isInTrial || !info.subscriptionStart) return false;
    if (info.billingPeriod !== "ANNUALLY") return false;
    return this.featuresRepository.checkIfFeatureIsEnabledGlobally("monthly-proration");
  }

  async onSeatChange(_context: SeatChangeContext): Promise<void> {
    // No immediate Stripe update -- proration is calculated and invoiced on a monthly cycle
  }
}
