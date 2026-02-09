import type { IFeaturesRepository } from "@calcom/features/flags/features.repository.interface";

import type { BillingPeriodInfo } from "../billingPeriod/BillingPeriodService";
import type { ISeatBillingStrategy, SeatChangeContext, SeatChangeResult } from "./ISeatBillingStrategy";

export class HighWaterMarkStrategy implements ISeatBillingStrategy {
  constructor(private readonly featuresRepository: IFeaturesRepository) {}

  async canHandle(info: BillingPeriodInfo): Promise<boolean> {
    if (info.isInTrial || !info.subscriptionStart) return false;
    if (info.billingPeriod !== "MONTHLY") return false;
    return this.featuresRepository.checkIfFeatureIsEnabledGlobally("hwm-seating");
  }

  async onSeatChange(_context: SeatChangeContext): Promise<SeatChangeResult> {
    return { handled: true, reason: "high water mark billing active for monthly plan" };
  }
}
