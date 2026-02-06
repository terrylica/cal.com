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

/**
 * ACTIVE_USERS billing strategy.
 * Webhook hooks are no-ops because active user counting and invoice
 * processing are handled by ActiveUserBillingService / OrgActiveUserInvoiceService
 * through separate code paths.
 *
 * Member changes are logged for audit purposes only -- no Stripe quantity update.
 */
export class ActiveUsersBillingStrategy implements IBillingModelStrategy {
  constructor(private readonly seatTracker: SeatChangeTrackingService = new SeatChangeTrackingService()) {}

  async handleInvoiceUpcoming(
    payload: InvoiceUpcomingPayload,
    logger: Logger<unknown>
  ): Promise<InvoiceUpcomingResult> {
    logger.debug(`ACTIVE_USERS: skipping invoice.upcoming for ${payload.subscriptionId}`);
    return { applied: false };
  }

  async handlePostRenewalReset(
    payload: PostRenewalResetPayload,
    logger: Logger<unknown>
  ): Promise<PostRenewalResetResult> {
    logger.debug(`ACTIVE_USERS: skipping post-renewal reset for ${payload.subscriptionId}`);
    return { success: true, updated: false };
  }

  async handleMemberAddition(payload: MemberChangePayload, logger: Logger<unknown>): Promise<void> {
    await this.seatTracker.logSeatAddition({
      teamId: payload.teamId,
      userId: payload.userId,
      triggeredBy: payload.triggeredBy,
      seatCount: payload.seatCount,
    });
    logger.debug("ACTIVE_USERS: seat addition logged for audit, no billing update", {
      teamId: payload.teamId,
    });
  }

  async handleMemberRemoval(payload: MemberChangePayload, logger: Logger<unknown>): Promise<void> {
    await this.seatTracker.logSeatRemoval({
      teamId: payload.teamId,
      userId: payload.userId,
      triggeredBy: payload.triggeredBy,
      seatCount: payload.seatCount,
    });
    logger.debug("ACTIVE_USERS: seat removal logged for audit, no billing update", {
      teamId: payload.teamId,
    });
  }

  async syncBillingQuantity(_payload: { teamId: number }, logger: Logger<unknown>): Promise<void> {
    logger.debug("ACTIVE_USERS: skipping billing quantity sync");
  }
}
