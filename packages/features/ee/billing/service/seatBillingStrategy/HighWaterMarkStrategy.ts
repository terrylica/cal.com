import type { IFeaturesRepository } from "@calcom/features/flags/features.repository.interface";
import logger from "@calcom/lib/logger";

import type { BillingPeriodInfo } from "../billingPeriod/BillingPeriodService";
import type { HighWaterMarkRepository } from "../../repository/highWaterMark/HighWaterMarkRepository";
import type { ISeatBillingStrategy, SeatChangeContext } from "./ISeatBillingStrategy";

const log = logger.getSubLogger({ prefix: ["HighWaterMarkStrategy"] });

export interface IHighWaterMarkStrategyDeps {
  featuresRepository: IFeaturesRepository;
  highWaterMarkRepository: HighWaterMarkRepository;
}

export class HighWaterMarkStrategy implements ISeatBillingStrategy {
  constructor(private readonly deps: IHighWaterMarkStrategyDeps) {}

  async canHandle(info: BillingPeriodInfo): Promise<boolean> {
    if (info.isInTrial || !info.subscriptionStart) return false;
    if (info.billingPeriod !== "MONTHLY") return false;
    return this.deps.featuresRepository.checkIfFeatureIsEnabledGlobally("hwm-seating");
  }

  async onSeatChange(context: SeatChangeContext): Promise<void> {
    if (context.changeType !== "addition") return;

    const billing = await this.deps.highWaterMarkRepository.getByTeamId(context.teamId);
    if (!billing) return;

    const periodStart = billing.highWaterMarkPeriodStart || billing.subscriptionStart;
    if (!periodStart) return;

    const result = await this.deps.highWaterMarkRepository.updateIfHigher({
      teamId: context.teamId,
      isOrganization: billing.isOrganization,
      newSeatCount: context.membershipCount,
      periodStart,
    });

    if (result.updated) {
      log.info(`High water mark updated for team ${context.teamId}`, {
        previousHighWaterMark: result.previousHighWaterMark,
        newHighWaterMark: context.membershipCount,
      });
    }
  }
}
