import { ErrorWithCode } from "@calcom/lib/errors";
import { logger, schemaTask, type TaskWithSchema } from "@trigger.dev/sdk";
import type { z } from "zod";
import { COUNT_ACTIVE_MANAGED_USERS_JOB_ID } from "../constants";
import { platformBillingTaskConfig } from "./config";
import { countActiveUsersTaskSchema } from "./schema";

export const countActiveUsers: TaskWithSchema<
  typeof COUNT_ACTIVE_MANAGED_USERS_JOB_ID,
  typeof countActiveUsersTaskSchema
> = schemaTask({
  id: COUNT_ACTIVE_MANAGED_USERS_JOB_ID,
  ...platformBillingTaskConfig,
  schema: countActiveUsersTaskSchema,
  run: async (payload: z.infer<typeof countActiveUsersTaskSchema>) => {
    const { getActiveUsersBillingTaskService } = await import(
      "@calcom/features/ee/organizations/di/tasker/ActiveUsersBillingTaskService.container"
    );

    const activeUsersBillingTaskService = getActiveUsersBillingTaskService();
    try {
      await activeUsersBillingTaskService.countActiveUsers(payload);
    } catch (error) {
      if (error instanceof Error || error instanceof ErrorWithCode) logger.error(error.message);
      else logger.error("Unknown error in countActiveUsers", { error });
      throw error;
    }
  },
});
