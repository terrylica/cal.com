import type { BillingPeriodInfo } from "../billingPeriod/BillingPeriodService";
import type { ISeatBillingStrategy, SeatChangeContext, SeatChangeResult } from "./ISeatBillingStrategy";

export class ImmediateUpdateStrategy implements ISeatBillingStrategy {
  async canHandle(_info: BillingPeriodInfo): Promise<boolean> {
    return true;
  }

  async onSeatChange(_context: SeatChangeContext): Promise<SeatChangeResult> {
    return { handled: false };
  }
}
