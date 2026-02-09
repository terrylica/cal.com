import type { BillingPeriodInfo } from "../billingPeriod/BillingPeriodService";

export interface SeatChangeContext {
  teamId: number;
  subscriptionId: string;
  subscriptionItemId: string;
  membershipCount: number;
}

export interface SeatChangeResult {
  handled: boolean;
  reason?: string;
}

export interface ISeatBillingStrategy {
  canHandle(info: BillingPeriodInfo): Promise<boolean>;
  onSeatChange(context: SeatChangeContext): Promise<SeatChangeResult>;
}
