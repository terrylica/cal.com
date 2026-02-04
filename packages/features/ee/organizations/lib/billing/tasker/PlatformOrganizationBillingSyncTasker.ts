import type { ITaskerDependencies } from "@calcom/lib/tasker/types";
import { nanoid } from "nanoid";
import type { ActiveUsersBillingTaskService } from "./ActiveUsersBillingTaskService";
import type { PlatformOrganizationBillingTaskService } from "./PlatformOrganizationBillingTaskService";
import type { IPlatformOrganizationBillingTasker } from "./types";

export interface IPlatformOrganizationBillingSyncTaskerDependencies {
  billingTaskService: PlatformOrganizationBillingTaskService;
  activeUsersBillingTaskService: ActiveUsersBillingTaskService;
}

export class PlatformOrganizationBillingSyncTasker implements IPlatformOrganizationBillingTasker {
  constructor(
    public readonly dependencies: ITaskerDependencies & IPlatformOrganizationBillingSyncTaskerDependencies
  ) {}

  async incrementUsage(
    payload: Parameters<IPlatformOrganizationBillingTasker["incrementUsage"]>[0]
  ): Promise<{ runId: string }> {
    const runId = `sync_${nanoid(10)}`;
    this.dependencies.logger.info(
      "Delayed tasks are not supported in sync mode, did not increment usage",
      runId,
      payload
    );
    return { runId };
  }

  async cancelUsageIncrement(
    payload: Parameters<IPlatformOrganizationBillingTasker["cancelUsageIncrement"]>[0]
  ): Promise<{ runId: string }> {
    const runId = `sync_${nanoid(10)}`;
    this.dependencies.logger.info(
      "Delayed tasks are not supported in sync mode, did not cancel usage increment",
      runId,
      payload
    );
    return { runId };
  }

  async rescheduleUsageIncrement(
    payload: Parameters<IPlatformOrganizationBillingTasker["rescheduleUsageIncrement"]>[0]
  ): Promise<{ runId: string }> {
    const runId = `sync_${nanoid(10)}`;
    this.dependencies.logger.info(
      "Delayed tasks are not supported in sync mode, did not reschedule usage increment",
      runId,
      payload
    );
    return { runId };
  }

  async countActiveUsers(
    payload: Parameters<IPlatformOrganizationBillingTasker["countActiveUsers"]>[0]
  ): Promise<{ runId: string }> {
    const runId = `sync_${nanoid(10)}`;
    await this.dependencies.activeUsersBillingTaskService.countActiveUsers(payload);
    this.dependencies.logger.info("Counted active users in sync mode", runId, payload);
    return { runId };
  }

  async invoiceActiveUsers(
    payload: Parameters<IPlatformOrganizationBillingTasker["invoiceActiveUsers"]>[0]
  ): Promise<{ runId: string }> {
    const runId = `sync_${nanoid(10)}`;
    await this.dependencies.activeUsersBillingTaskService.invoiceActiveUsers(payload);
    this.dependencies.logger.info("Invoiced active users in sync mode", runId);
    return { runId };
  }
}
