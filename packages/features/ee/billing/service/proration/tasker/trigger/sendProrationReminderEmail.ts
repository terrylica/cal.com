import { schemaTask } from "@trigger.dev/sdk";

import { prorationEmailTaskConfig } from "./emailConfig";
import { sendReminderEmailSchema } from "./emailSchemas";

export const sendProrationReminderEmail = schemaTask({
  id: "billing.proration.send-reminder-email",
  ...prorationEmailTaskConfig,
  schema: sendReminderEmailSchema,
  run: async (payload) => {
    const { getProrationEmailService } = await import(
      "@calcom/features/ee/billing/di/containers/ProrationEmailService"
    );
    const emailService = getProrationEmailService();
    await emailService.sendReminderEmail(payload);
    return { success: true };
  },
});
