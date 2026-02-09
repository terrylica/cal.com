import logger from "@calcom/lib/logger";
import type { BillingModel, BillingPeriod } from "@calcom/prisma/enums";
import type { Logger } from "tslog";
import { getBillingModelRepository } from "../../di/containers/Billing";
import { ActiveUsersBillingStrategy } from "./ActiveUsersBillingStrategy";
import type { IBillingModelStrategy } from "./IBillingModelStrategy";
import { SeatsHwmBillingStrategy } from "./SeatsHwmBillingStrategy";
import { SeatsProrationBillingStrategy } from "./SeatsProrationBillingStrategy";

const defaultLog = logger.getSubLogger({
  prefix: ["BillingModelStrategyFactory"],
});

// Stateless singletons
const seatsHwm = new SeatsHwmBillingStrategy();
const seatsProration = new SeatsProrationBillingStrategy();
const activeUsers = new ActiveUsersBillingStrategy();

export interface StrategyLookupResult {
  strategy: IBillingModelStrategy;
  billingModel: BillingModel;
  billingPeriod: BillingPeriod | null;
}

function resolveStrategy(
  billingModel: BillingModel,
  billingPeriod: BillingPeriod | null
): IBillingModelStrategy {
  if (billingModel === "ACTIVE_USERS") {
    return activeUsers;
  }
  // SEATS: pick HWM vs proration based on billing period
  if (billingPeriod === "MONTHLY") {
    return seatsHwm;
  }
  return seatsProration;
}

export async function getStrategyForSubscription(
  subscriptionId: string,
  log: Logger<unknown> = defaultLog
): Promise<StrategyLookupResult | null> {
  const repository = getBillingModelRepository();
  const record = await repository.findBySubscriptionId(subscriptionId);

  if (!record) {
    log.warn(`No billing record found for subscription ${subscriptionId}`);
    return null;
  }

  const strategy = resolveStrategy(record.billingModel, record.billingPeriod);
  log.debug("Found billing strategy for subscription", {
    subscriptionId,
    billingModel: record.billingModel,
    billingPeriod: record.billingPeriod,
  });

  return {
    strategy,
    billingModel: record.billingModel,
    billingPeriod: record.billingPeriod,
  };
}

export async function getStrategyForTeam(
  teamId: number,
  log: Logger<unknown> = defaultLog
): Promise<StrategyLookupResult | null> {
  const repository = getBillingModelRepository();
  const record = await repository.findByTeamId(teamId);

  if (!record) {
    log.warn(`No billing record found for team ${teamId}`);
    return null;
  }

  const strategy = resolveStrategy(record.billingModel, record.billingPeriod);
  log.debug("Found billing strategy for team", {
    teamId,
    billingModel: record.billingModel,
    billingPeriod: record.billingPeriod,
  });

  return {
    strategy,
    billingModel: record.billingModel,
    billingPeriod: record.billingPeriod,
  };
}
