import { getFeaturesRepository } from "@calcom/features/di/containers/FeaturesRepository";
import { HighWaterMarkRepository } from "@calcom/features/ee/billing/repository/highWaterMark/HighWaterMarkRepository";
import { MonthlyProrationTeamRepository } from "@calcom/features/ee/billing/repository/proration/MonthlyProrationTeamRepository";
import type { IFeaturesRepository } from "@calcom/features/flags/features.repository.interface";
import logger from "@calcom/lib/logger";
import type { Logger } from "tslog";

import type { IBillingProviderService } from "../billingProvider/IBillingProviderService";

const log = logger.getSubLogger({ prefix: ["HighWaterMarkService"] });

export interface HighWaterMarkUpdateResult {
  updated: boolean;
  previousHighWaterMark: number | null;
  newHighWaterMark: number;
}

export interface HighWaterMarkServiceDeps {
  logger?: Logger<unknown>;
  repository?: HighWaterMarkRepository;
  teamRepository?: MonthlyProrationTeamRepository;
  billingService?: IBillingProviderService;
  featuresRepository?: IFeaturesRepository;
}

export class HighWaterMarkService {
  private logger: Logger<unknown>;
  private repository: HighWaterMarkRepository;
  private teamRepository: MonthlyProrationTeamRepository;
  private billingService?: IBillingProviderService;
  private featuresRepository: IFeaturesRepository;

  constructor(deps?: HighWaterMarkServiceDeps) {
    this.logger = deps?.logger || log;
    this.repository = deps?.repository || new HighWaterMarkRepository();
    this.teamRepository = deps?.teamRepository || new MonthlyProrationTeamRepository();
    this.billingService = deps?.billingService;
    this.featuresRepository = deps?.featuresRepository || getFeaturesRepository();
  }

  async shouldApplyHighWaterMark(teamId: number): Promise<boolean> {
    try {
      const isEnabled = await this.featuresRepository.checkIfFeatureIsEnabledGlobally("hwm-seating");
      if (!isEnabled) {
        return false;
      }

      const billing = await this.repository.getByTeamId(teamId);
      if (!billing) {
        return false;
      }

      // Only apply HWM for monthly billing
      return billing.billingPeriod === "MONTHLY";
    } catch (error) {
      this.logger.error(`Failed to check if high water mark should apply for team ${teamId}`, { error });
      return false;
    }
  }

  async updateHighWaterMarkOnSeatAddition(params: {
    teamId: number;
    currentPeriodStart: Date;
  }): Promise<HighWaterMarkUpdateResult | null> {
    const { teamId, currentPeriodStart } = params;

    const shouldApply = await this.shouldApplyHighWaterMark(teamId);
    if (!shouldApply) {
      return null;
    }

    const billing = await this.repository.getByTeamId(teamId);
    if (!billing) {
      this.logger.warn(`No billing record found for team ${teamId}`);
      return null;
    }

    // Get current member count
    const memberCount = await this.teamRepository.getTeamMemberCount(teamId);
    if (memberCount === null) {
      this.logger.warn(`Could not get member count for team ${teamId}`);
      return null;
    }

    const previousHighWaterMark = billing.highWaterMark;

    // Determine if update is needed: new period resets, null initializes, higher value wins
    const isNewPeriod =
      !billing.highWaterMarkPeriodStart ||
      currentPeriodStart.getTime() !== billing.highWaterMarkPeriodStart.getTime();
    const shouldUpdate = isNewPeriod || previousHighWaterMark === null || memberCount > previousHighWaterMark;

    if (!shouldUpdate) {
      this.logger.info(`High water mark unchanged for team ${teamId}`, {
        updated: false,
        previousHighWaterMark,
        memberCount,
      });
      return {
        updated: false,
        previousHighWaterMark,
        newHighWaterMark: previousHighWaterMark ?? memberCount,
      };
    }

    await this.repository.setHighWaterMark({
      teamId,
      isOrganization: billing.isOrganization,
      highWaterMark: memberCount,
      periodStart: currentPeriodStart,
    });

    this.logger.info(`High water mark updated for team ${teamId}`, {
      updated: true,
      previousHighWaterMark,
      newHighWaterMark: memberCount,
      memberCount,
    });

    return {
      updated: true,
      previousHighWaterMark,
      newHighWaterMark: memberCount,
    };
  }

  async resetHighWaterMark(params: {
    teamId: number;
    isOrganization: boolean;
    newPeriodStart: Date;
  }): Promise<void> {
    const { teamId, isOrganization, newPeriodStart } = params;

    // Get current member count
    const memberCount = await this.teamRepository.getTeamMemberCount(teamId);
    if (memberCount === null) {
      this.logger.warn(`Could not get member count for team ${teamId}`);
      return;
    }

    await this.repository.reset({
      teamId,
      isOrganization,
      currentSeatCount: memberCount,
      newPeriodStart,
    });

    this.logger.info(`High water mark reset for team ${teamId}`, {
      newHighWaterMark: memberCount,
      newPeriodStart,
    });
  }

  async applyHighWaterMarkToSubscription(subscriptionId: string): Promise<boolean> {
    // Check feature flag first
    const isEnabled = await this.featuresRepository.checkIfFeatureIsEnabledGlobally("hwm-seating");
    if (!isEnabled) {
      this.logger.debug(
        `HWM feature flag disabled, skipping applyHighWaterMarkToSubscription for ${subscriptionId}`
      );
      return false;
    }

    if (!this.billingService) {
      this.logger.error("BillingService not configured for high water mark processing");
      return false;
    }

    const billing = await this.repository.getBySubscriptionId(subscriptionId);
    if (!billing) {
      this.logger.warn(`No billing record found for subscription ${subscriptionId}`);
      return false;
    }

    // Only apply for monthly billing
    if (billing.billingPeriod !== "MONTHLY") {
      this.logger.debug(`Skipping HWM for non-monthly subscription ${subscriptionId}`);
      return false;
    }

    const { teamId, subscriptionItemId, isOrganization } = billing;
    let { highWaterMark, paidSeats } = billing;

    if (highWaterMark === null) {
      const initialized = await this.lazyInitializeHighWaterMark(billing);
      if (initialized === null) {
        return false;
      }
      highWaterMark = initialized;
    }

    if (paidSeats === null) {
      const synced = await this.syncPaidSeatsFromStripe({ subscriptionId, teamId, isOrganization });
      if (synced === null) {
        return false;
      }
      paidSeats = synced;
    }

    // If HWM equals paid seats, no update needed
    if (highWaterMark === paidSeats) {
      this.logger.debug(`No HWM update needed for team ${teamId} - already at correct quantity`, {
        highWaterMark,
        paidSeats,
      });
      return false;
    }

    // Determine if scaling up or down
    const isScalingUp = highWaterMark > paidSeats;
    this.logger.info(`${isScalingUp ? "Scaling up" : "Scaling down"} subscription for team ${teamId}`, {
      highWaterMark,
      currentPaidSeats: paidSeats,
      subscriptionId,
      direction: isScalingUp ? "up" : "down",
    });

    // Update the subscription quantity to the high water mark
    await this.billingService.handleSubscriptionUpdate({
      subscriptionId,
      subscriptionItemId,
      membershipCount: highWaterMark,
      prorationBehavior: "none",
    });

    // Update our local record of paid seats
    await this.repository.updateQuantityAfterStripeSync({
      teamId,
      isOrganization,
      paidSeats: highWaterMark,
    });

    this.logger.info(`Successfully applied high water mark for team ${teamId}`, {
      newPaidSeats: highWaterMark,
    });

    return true;
  }

  /**
   * Lazily initialize HWM when it hasn't been tracked yet.
   * Returns the initialized member count, or null if initialization failed.
   */
  private async lazyInitializeHighWaterMark(billing: {
    teamId: number;
    isOrganization: boolean;
    highWaterMarkPeriodStart: Date | null;
    subscriptionStart: Date | null;
  }): Promise<number | null> {
    const { teamId, isOrganization } = billing;

    const memberCount = await this.teamRepository.getTeamMemberCount(teamId);
    if (memberCount === null) {
      this.logger.warn(`Could not get member count for team ${teamId} during lazy init`);
      return null;
    }

    const periodStart = billing.highWaterMarkPeriodStart || billing.subscriptionStart;
    if (!periodStart) {
      this.logger.warn(
        `Could not determine period start for team ${teamId} during lazy init - no subscriptionStart available`
      );
      return null;
    }

    await this.repository.reset({
      teamId,
      isOrganization,
      currentSeatCount: memberCount,
      newPeriodStart: periodStart,
    });

    this.logger.info(`Lazy initialized high water mark for team ${teamId}`, {
      initialHighWaterMark: memberCount,
      periodStart,
    });

    return memberCount;
  }

  /**
   * Sync paidSeats from Stripe when our local record is missing.
   * Returns the synced quantity, or null if the sync failed.
   */
  private async syncPaidSeatsFromStripe(params: {
    subscriptionId: string;
    teamId: number;
    isOrganization: boolean;
  }): Promise<number | null> {
    const { subscriptionId, teamId, isOrganization } = params;

    if (!this.billingService) {
      this.logger.error("BillingService not configured for paidSeats sync");
      return null;
    }

    const subscription = await this.billingService.getSubscription(subscriptionId);
    if (!subscription?.items?.[0]) {
      this.logger.warn(`Could not get subscription details for ${subscriptionId}`);
      return null;
    }

    const paidSeats = subscription.items[0].quantity;
    await this.repository.updateQuantityAfterStripeSync({
      teamId,
      isOrganization,
      paidSeats,
    });

    this.logger.info(`Synced paidSeats from Stripe for team ${teamId}`, { paidSeats });
    return paidSeats;
  }

  async getHighWaterMarkData(teamId: number) {
    return this.repository.getByTeamId(teamId);
  }

  /**
   * Reset subscription quantity to current member count after a billing period renewal.
   * This allows seats to scale DOWN when members have been removed during the previous period.
   *
   * Flow:
   * 1. invoice.upcoming: applyHighWaterMarkToSubscription sets quantity to HWM (peak)
   * 2. Stripe generates invoice for HWM seats
   * 3. customer.subscription.updated (period change): This method resets to current members
   */
  async resetSubscriptionAfterRenewal(params: {
    subscriptionId: string;
    newPeriodStart: Date;
  }): Promise<boolean> {
    const { subscriptionId, newPeriodStart } = params;

    // Check feature flag first
    const isEnabled = await this.featuresRepository.checkIfFeatureIsEnabledGlobally("hwm-seating");
    if (!isEnabled) {
      this.logger.debug(
        `HWM feature flag disabled, skipping resetSubscriptionAfterRenewal for ${subscriptionId}`
      );
      return false;
    }

    if (!this.billingService) {
      this.logger.error("BillingService not configured for subscription reset");
      return false;
    }

    const billing = await this.repository.getBySubscriptionId(subscriptionId);
    if (!billing) {
      this.logger.warn(`No billing record found for subscription ${subscriptionId}`);
      return false;
    }

    // Only apply for monthly billing
    if (billing.billingPeriod !== "MONTHLY") {
      this.logger.debug(`Skipping reset for non-monthly subscription ${subscriptionId}`);
      return false;
    }

    const { teamId, subscriptionItemId, isOrganization, paidSeats } = billing;

    // Get current member count
    const memberCount = await this.teamRepository.getTeamMemberCount(teamId);
    if (memberCount === null) {
      this.logger.warn(`Could not get member count for team ${teamId}`);
      return false;
    }

    // If current members equals paid seats, no update needed
    if (memberCount === paidSeats) {
      this.logger.debug(`No reset needed for team ${teamId} - already at correct quantity`, {
        memberCount,
        paidSeats,
      });

      // Still reset HWM for the new period
      await this.repository.reset({
        teamId,
        isOrganization,
        currentSeatCount: memberCount,
        newPeriodStart,
      });

      return false;
    }

    this.logger.info(`Resetting subscription for team ${teamId} after renewal`, {
      currentMembers: memberCount,
      previousPaidSeats: paidSeats,
      subscriptionId,
      direction: memberCount < (paidSeats ?? 0) ? "down" : "up",
    });

    // Update the subscription quantity to current member count
    await this.billingService.handleSubscriptionUpdate({
      subscriptionId,
      subscriptionItemId,
      membershipCount: memberCount,
      prorationBehavior: "none",
    });

    // Reset HWM to current member count for the new period
    await this.repository.reset({
      teamId,
      isOrganization,
      currentSeatCount: memberCount,
      newPeriodStart,
    });

    // Update our local record of paid seats
    await this.repository.updateQuantityAfterStripeSync({
      teamId,
      isOrganization,
      paidSeats: memberCount,
    });

    this.logger.info(`Successfully reset subscription for team ${teamId}`, {
      newPaidSeats: memberCount,
      newHighWaterMark: memberCount,
      newPeriodStart,
    });

    return true;
  }
}
