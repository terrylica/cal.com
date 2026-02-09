import logger from "@calcom/lib/logger";
import { getStrategyForSubscription } from "../../service/billingModelStrategy/BillingModelStrategyFactory";
import type { SWHMap } from "./__handler";

type Data = SWHMap["invoice.upcoming"]["data"];

const log = logger.getSubLogger({ prefix: ["stripe-webhook-invoice-upcoming"] });

const handler = async (data: Data) => {
  const invoice = data.object;

  // Only handle subscription invoices
  if (!invoice.subscription) {
    log.debug("Not a subscription invoice, skipping");
    return { success: false, message: "Not a subscription invoice" };
  }

  const subscriptionId =
    typeof invoice.subscription === "string" ? invoice.subscription : invoice.subscription.id;

  log.info("Processing invoice.upcoming webhook", {
    invoiceId: invoice.id,
    subscriptionId,
    customerId: typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id,
  });

  try {
    const result = await getStrategyForSubscription(subscriptionId, log);

    if (!result) {
      log.debug("No billing record found, skipping", { subscriptionId });
      return { success: true, highWaterMarkApplied: false };
    }

    const { strategy, billingModel, billingPeriod } = result;
    log.info("Dispatching invoice.upcoming to billing model strategy", {
      subscriptionId,
      billingModel,
      billingPeriod,
    });

    const { applied } = await strategy.handleInvoiceUpcoming({ subscriptionId }, log);

    if (applied) {
      log.info("Strategy applied changes before renewal", { subscriptionId, billingModel });
      return { success: true, highWaterMarkApplied: true };
    }

    log.debug("No changes needed before renewal", { subscriptionId, billingModel });
    return { success: true, highWaterMarkApplied: false };
  } catch (error) {
    log.error("Failed to process invoice.upcoming", {
      subscriptionId,
      error,
    });
    return { success: false, error: String(error) };
  }
};

export default handler;
