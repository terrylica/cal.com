import { schemaTask } from "@trigger.dev/sdk";

import { prorationEmailTaskConfig } from "./emailConfig";
import { sendInvoiceEmailSchema } from "./emailSchemas";

export const sendProrationInvoiceEmail = schemaTask({
  id: "billing.proration.send-invoice-email",
  ...prorationEmailTaskConfig,
  schema: sendInvoiceEmailSchema,
  run: async (payload) => {
    const { getProrationEmailService } = await import(
      "@calcom/features/ee/billing/di/containers/ProrationEmailService"
    );
    const emailService = getProrationEmailService();
    await emailService.sendInvoiceEmail(payload);
    return { success: true };
  },
});
