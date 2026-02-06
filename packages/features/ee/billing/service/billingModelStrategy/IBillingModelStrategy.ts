import type { Logger } from "tslog";

export interface InvoiceUpcomingPayload {
  subscriptionId: string;
}

export interface InvoiceUpcomingResult {
  applied: boolean;
}

export interface PostRenewalResetPayload {
  subscriptionId: string;
  periodStartTimestamp: number;
}

export interface PostRenewalResetResult {
  success: boolean;
  updated?: boolean;
  error?: string;
}

export interface MemberChangePayload {
  teamId: number;
  seatCount: number;
  userId?: number;
  triggeredBy?: number;
}

/**
 * Strategy interface for billing-model-specific behavior.
 *
 * The factory selects a strategy based on billingModel + billingPeriod:
 *   SEATS + MONTHLY   -> SeatsHwmBillingStrategy
 *   SEATS + ANNUALLY  -> SeatsProrationBillingStrategy
 *   ACTIVE_USERS      -> ActiveUsersBillingStrategy
 */
export interface IBillingModelStrategy {
  /** Called on invoice.upcoming: prepare the subscription before Stripe generates the renewal invoice. */
  handleInvoiceUpcoming(
    payload: InvoiceUpcomingPayload,
    logger: Logger<unknown>
  ): Promise<InvoiceUpcomingResult>;

  /** Called on invoice.paid (subscription_cycle): reset state after a successful renewal payment. */
  handlePostRenewalReset(
    payload: PostRenewalResetPayload,
    logger: Logger<unknown>
  ): Promise<PostRenewalResetResult>;

  /** Called when members are added to a team/org. Handles seat logging and billing updates. */
  handleMemberAddition(payload: MemberChangePayload, logger: Logger<unknown>): Promise<void>;

  /** Called when members are removed from a team/org. Handles seat logging and billing updates. */
  handleMemberRemoval(payload: MemberChangePayload, logger: Logger<unknown>): Promise<void>;

  /**
   * Sync Stripe subscription quantity without logging seat changes.
   * Use this when seat tracking has already been handled separately (e.g. by invite utils)
   * or when called for child teams where updateQuantity resolves to the parent org internally.
   */
  syncBillingQuantity(payload: { teamId: number }, logger: Logger<unknown>): Promise<void>;
}
