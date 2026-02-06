import type { Logger } from "tslog";
import type { IBillingProviderService } from "../billingProvider/IBillingProviderService";
import { getBillingProviderService, getTeamBillingServiceFactory } from "../../di/containers/Billing";
import { HighWaterMarkService } from "../highWaterMark/HighWaterMarkService";
import { SeatChangeTrackingService } from "../seatTracking/SeatChangeTrackingService";
import type {
  IBillingModelStrategy,
  InvoiceUpcomingPayload,
  InvoiceUpcomingResult,
  MemberChangePayload,
  PostRenewalResetPayload,
  PostRenewalResetResult,
} from "./IBillingModelStrategy";

export interface SeatsHwmBillingStrategyDeps {
  seatTracker?: SeatChangeTrackingService;
  billingProviderService?: IBillingProviderService;
  teamBillingServiceFactory?: ReturnType<typeof getTeamBillingServiceFactory>;
}

/**
 * SEATS + MONTHLY billing strategy.
 * Uses High Water Mark to adjust subscription quantity before renewal
 * and reset after payment.
 */
export class SeatsHwmBillingStrategy implements IBillingModelStrategy {
  private readonly seatTracker: SeatChangeTrackingService;
  private readonly getBillingProvider: () => IBillingProviderService;
  private readonly getFactory: () => ReturnType<typeof getTeamBillingServiceFactory>;

  constructor(deps?: SeatsHwmBillingStrategyDeps) {
    this.seatTracker = deps?.seatTracker ?? new SeatChangeTrackingService();
    this.getBillingProvider = () => deps?.billingProviderService ?? getBillingProviderService();
    this.getFactory = () => deps?.teamBillingServiceFactory ?? getTeamBillingServiceFactory();
  }

  async handleInvoiceUpcoming(
    payload: InvoiceUpcomingPayload,
    logger: Logger<unknown>
  ): Promise<InvoiceUpcomingResult> {
    const billingService = this.getBillingProvider();
    const hwmService = new HighWaterMarkService({ logger, billingService });
    const applied = await hwmService.applyHighWaterMarkToSubscription(payload.subscriptionId);
    return { applied };
  }

  async handlePostRenewalReset(
    payload: PostRenewalResetPayload,
    logger: Logger<unknown>
  ): Promise<PostRenewalResetResult> {
    const newPeriodStart = new Date(payload.periodStartTimestamp * 1000);
    const billingService = this.getBillingProvider();
    const hwmService = new HighWaterMarkService({ logger, billingService });

    try {
      const updated = await hwmService.resetSubscriptionAfterRenewal({
        subscriptionId: payload.subscriptionId,
        newPeriodStart,
      });

      logger.info("HWM reset after invoice paid", {
        subscriptionId: payload.subscriptionId,
        newPeriodStart,
        updated,
      });

      return { success: true, updated };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error("Failed to reset HWM after invoice paid", {
        subscriptionId: payload.subscriptionId,
        error: errorMessage,
      });
      return { success: false, error: errorMessage };
    }
  }

  async handleMemberAddition(payload: MemberChangePayload, logger: Logger<unknown>): Promise<void> {
    await this.seatTracker.logSeatAddition({
      teamId: payload.teamId,
      userId: payload.userId,
      triggeredBy: payload.triggeredBy,
      seatCount: payload.seatCount,
    });

    await this.syncBillingQuantity({ teamId: payload.teamId }, logger);
  }

  async handleMemberRemoval(payload: MemberChangePayload, logger: Logger<unknown>): Promise<void> {
    await this.seatTracker.logSeatRemoval({
      teamId: payload.teamId,
      userId: payload.userId,
      triggeredBy: payload.triggeredBy,
      seatCount: payload.seatCount,
    });

    await this.syncBillingQuantity({ teamId: payload.teamId }, logger);
  }

  async syncBillingQuantity(payload: { teamId: number }, logger: Logger<unknown>): Promise<void> {
    try {
      const factory = this.getFactory();
      const billingService = await factory.findAndInit(payload.teamId);
      await billingService.updateQuantity();
    } catch (error) {
      logger.error("Failed to sync billing quantity", {
        teamId: payload.teamId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
