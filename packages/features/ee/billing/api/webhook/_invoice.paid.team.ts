import { getBillingProviderService } from "@calcom/ee/billing/di/containers/Billing";
import { HighWaterMarkService } from "@calcom/features/ee/billing/service/highWaterMark/HighWaterMarkService";
import logger from "@calcom/lib/logger";
import { z } from "zod";
import type { SWHMap } from "./__handler";

const log = logger.getSubLogger({ prefix: ["invoice-paid-team"] });

const invoicePaidSchema = z.object({
  object: z.object({
    customer: z.string(),
    subscription: z.string(),
    billing_reason: z.string().nullable(),
    lines: z.object({
      data: z.array(
        z.object({
          subscription_item: z.string(),
          period: z
            .object({
              start: z.number(),
              end: z.number(),
            })
            .optional(),
        })
      ),
    }),
  }),
});

async function handleHwmResetAfterRenewal(
  subscriptionId: string,
  periodStartTimestamp: number | undefined
): Promise<boolean> {
  if (!periodStartTimestamp) {
    log.warn(`No period start timestamp for subscription ${subscriptionId}, skipping HWM reset`);
    return false;
  }

  const newPeriodStart = new Date(periodStartTimestamp * 1000);
  const billingProviderService = getBillingProviderService();
  const highWaterMarkService = new HighWaterMarkService({
    logger: log,
    billingService: billingProviderService,
  });

  try {
    const updated = await highWaterMarkService.resetSubscriptionAfterRenewal({
      subscriptionId,
      newPeriodStart,
    });
    log.info("HWM reset after invoice paid", {
      subscriptionId,
      newPeriodStart,
      updated,
    });
    return updated;
  } catch (error) {
    log.error("Failed to reset HWM after invoice paid", {
      subscriptionId,
      error,
    });
    return false;
  }
}

const handler = async (data: SWHMap["invoice.paid"]["data"]) => {
  const { object: invoice } = invoicePaidSchema.parse(data);
  const subscriptionId = invoice.subscription;

  log.debug(`Processing invoice paid webhook for team subscription ${subscriptionId}`, {
    billingReason: invoice.billing_reason,
    customerId: invoice.customer,
  });

  // Only handle renewal invoices for HWM reset
  if (invoice.billing_reason === "subscription_cycle") {
    log.info(`Processing renewal invoice for team subscription ${subscriptionId}`);
    const periodStart = invoice.lines.data[0]?.period?.start;
    await handleHwmResetAfterRenewal(subscriptionId, periodStart);
  }

  return { success: true };
};

export default handler;
