import { getMonthlyProrationService } from "@calcom/features/ee/billing/di/containers/MonthlyProrationService";
import { getProrationEmailService } from "@calcom/features/ee/billing/di/containers/ProrationEmailService";
import { nanoid } from "nanoid";

import type { IMonthlyProrationTasker } from "./types";

export class MonthlyProrationSyncTasker implements IMonthlyProrationTasker {
  async processBatch(payload: Parameters<IMonthlyProrationTasker["processBatch"]>[0]) {
    const runId = `sync_${nanoid(10)}`;
    const prorationService = getMonthlyProrationService();
    const prorationResults = await prorationService.processMonthlyProrations(payload);

    const emailService = getProrationEmailService();
    for (const proration of prorationResults) {
      const isAutoCharge = proration.status === "INVOICE_CREATED";
      const isPending = proration.status === "PENDING";

      if (isAutoCharge || isPending) {
        await emailService.sendInvoiceEmail({
          prorationId: proration.id,
          teamId: proration.teamId,
          isAutoCharge,
        });
        // Note: In sync mode, reminder emails are not scheduled
        // as they require Trigger.dev for delayed execution
      }
    }

    return { runId };
  }
}
