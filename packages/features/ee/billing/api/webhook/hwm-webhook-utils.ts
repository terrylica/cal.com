import logger from "@calcom/lib/logger";
import type { Logger } from "tslog";
import { getStrategyForSubscription } from "../../service/billingModelStrategy/BillingModelStrategyFactory";
import type { PostRenewalResetResult } from "../../service/billingModelStrategy/IBillingModelStrategy";

export type { PostRenewalResetResult };

const defaultLogger = logger.getSubLogger({ prefix: ["hwm-webhook-utils"] });

export function extractPeriodStartFromInvoice(
  linesData: Array<{ period?: { start: number; end: number } }>
): number | undefined {
  if (!linesData || linesData.length === 0) {
    return undefined;
  }
  return linesData[0]?.period?.start;
}

export function validateInvoiceLinesForHwm(
  linesData: Array<{ period?: { start: number; end: number } }>,
  subscriptionId: string,
  log: Logger<unknown> = defaultLogger
): { isValid: boolean; periodStart?: number } {
  if (!linesData || linesData.length === 0) {
    log.warn(`Invoice has no line items for subscription ${subscriptionId}, cannot process HWM`);
    return { isValid: false };
  }

  const periodStart = linesData[0]?.period?.start;
  if (!periodStart) {
    log.warn(`Invoice line item missing period.start for subscription ${subscriptionId}, cannot process HWM`);
    return { isValid: false };
  }

  return { isValid: true, periodStart };
}

export async function handlePostRenewalReset(
  subscriptionId: string,
  periodStartTimestamp: number | undefined,
  log: Logger<unknown> = defaultLogger
): Promise<PostRenewalResetResult> {
  if (!periodStartTimestamp) {
    log.warn(`No period start timestamp for subscription ${subscriptionId}, skipping post-renewal reset`);
    return { success: false, error: "No period start timestamp" };
  }

  const result = await getStrategyForSubscription(subscriptionId, undefined, log);

  if (!result) {
    log.warn(`No billing record found for subscription ${subscriptionId}, skipping post-renewal reset`);
    return { success: false, error: "No billing record found" };
  }

  const { strategy, billingModel, billingPeriod } = result;
  log.info("Dispatching post-renewal reset to billing model strategy", {
    subscriptionId,
    billingModel,
    billingPeriod,
  });

  return strategy.handlePostRenewalReset({ subscriptionId, periodStartTimestamp }, log);
}
