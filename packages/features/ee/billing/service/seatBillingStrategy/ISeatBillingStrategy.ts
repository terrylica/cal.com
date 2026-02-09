import type { BillingPeriodInfo } from "../billingPeriod/BillingPeriodService";

export type SeatChangeType = "addition" | "removal" | "sync";

export interface SeatChangeContext {
  teamId: number;
  subscriptionId: string;
  subscriptionItemId: string;
  membershipCount: number;
  changeType: SeatChangeType;
}

export interface ISeatBillingStrategy {
  canHandle(info: BillingPeriodInfo): Promise<boolean>;
  onSeatChange(context: SeatChangeContext): Promise<void>;
  onInvoiceUpcoming(subscriptionId: string): Promise<{ applied: boolean }>;
  onRenewalPaid(subscriptionId: string, periodStart: Date): Promise<{ reset: boolean }>;
}
