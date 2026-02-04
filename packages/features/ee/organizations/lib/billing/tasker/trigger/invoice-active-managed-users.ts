import { ErrorWithCode } from "@calcom/lib/errors";
import { logger, schemaTask, type TaskWithSchema } from "@trigger.dev/sdk";
import type { z } from "zod";
import { INVOICE_ACTIVE_MANAGED_USERS_JOB_ID } from "../constants";
import { platformBillingTaskConfig } from "./config";
import { invoiceActiveUsersTaskSchema } from "./schema";

export const invoiceActiveUsers: TaskWithSchema<
  typeof INVOICE_ACTIVE_MANAGED_USERS_JOB_ID,
  typeof invoiceActiveUsersTaskSchema
> = schemaTask({
  id: INVOICE_ACTIVE_MANAGED_USERS_JOB_ID,
  ...platformBillingTaskConfig,
  schema: invoiceActiveUsersTaskSchema,
  run: async (payload: z.infer<typeof invoiceActiveUsersTaskSchema>) => {
    const { getActiveUsersBillingTaskService } = await import(
      "@calcom/features/ee/organizations/di/tasker/ActiveUsersBillingTaskService.container"
    );

    const activeUsersBillingTaskService = getActiveUsersBillingTaskService();
    try {
      await activeUsersBillingTaskService.invoiceActiveUsers(payload);
    } catch (error) {
      if (error instanceof Error || error instanceof ErrorWithCode) logger.error(error.message);
      else logger.error("Unknown error in invoiceActiveUsers", { error });
      throw error;
    }
  },
});
