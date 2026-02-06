import type { Logger } from "tslog";
import { SeatChangeTrackingService } from "../seatTracking/SeatChangeTrackingService";
import type {
  IBillingModelStrategy,
  InvoiceUpcomingPayload,
  InvoiceUpcomingResult,
  MemberChangePayload,
  PostRenewalResetPayload,
  PostRenewalResetResult,
} from "./IBillingModelStrategy";

export interface SeatsProrationBillingStrategyDeps {
  seatTracker?: SeatChangeTrackingService;
}

/**
 * SEATS + ANNUALLY billing strategy.
 * Stripe subscription quantity is NOT updated at member-change time.
 * Instead, MonthlyProrationService (trigger.dev cron on 1st of month)
 * reads seat change logs, creates a prorated invoice, and updates
 * the Stripe quantity only after payment succeeds.
 */
export class SeatsProrationBillingStrategy implements IBillingModelStrategy {
  private readonly seatTracker: SeatChangeTrackingService;

  constructor(deps?: SeatsProrationBillingStrategyDeps) {
    this.seatTracker = deps?.seatTracker ?? new SeatChangeTrackingService();
  }

  async handleInvoiceUpcoming(
    payload: InvoiceUpcomingPayload,
    logger: Logger<unknown>
  ): Promise<InvoiceUpcomingResult> {
    logger.debug(`SEATS+ANNUAL: skipping invoice.upcoming for ${payload.subscriptionId}`);
    return { applied: false };
  }

  async handlePostRenewalReset(
    payload: PostRenewalResetPayload,
    logger: Logger<unknown>
  ): Promise<PostRenewalResetResult> {
    logger.debug(`SEATS+ANNUAL: skipping post-renewal reset for ${payload.subscriptionId}`);
    return { success: true, updated: false };
  }

  async handleMemberAddition(payload: MemberChangePayload, logger: Logger<unknown>): Promise<void> {
    await this.seatTracker.logSeatAddition({
      teamId: payload.teamId,
      userId: payload.userId,
      triggeredBy: payload.triggeredBy,
      seatCount: payload.seatCount,
    });
    logger.debug(`SEATS+ANNUAL: seat addition logged for team ${payload.teamId}, Stripe sync deferred to MonthlyProrationService`);
  }

  async handleMemberRemoval(payload: MemberChangePayload, logger: Logger<unknown>): Promise<void> {
    await this.seatTracker.logSeatRemoval({
      teamId: payload.teamId,
      userId: payload.userId,
      triggeredBy: payload.triggeredBy,
      seatCount: payload.seatCount,
    });
    logger.debug(`SEATS+ANNUAL: seat removal logged for team ${payload.teamId}, Stripe sync deferred to MonthlyProrationService`);
  }

  async syncBillingQuantity(_payload: { teamId: number }, logger: Logger<unknown>): Promise<void> {
    logger.debug("SEATS+ANNUAL: skipping billing quantity sync -- handled by MonthlyProrationService");
  }
}
