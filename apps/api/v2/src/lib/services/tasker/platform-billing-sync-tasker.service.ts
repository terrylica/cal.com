import { PlatformOrganizationBillingSyncTasker as BasePlatformOrganizationBillingSyncTasker } from "@calcom/platform-libraries/organizations";
import { Injectable } from "@nestjs/common";
import { Logger } from "@/lib/logger.bridge";
import { ActiveUsersBillingTaskService } from "@/lib/services/tasker/active-users-billing-task.service";
import { PlatformBillingTaskService } from "@/lib/services/tasker/platform-billing-task.service";

@Injectable()
export class PlatformBillingSyncTaskerService extends BasePlatformOrganizationBillingSyncTasker {
  constructor(
    billingTaskService: PlatformBillingTaskService,
    activeUsersBillingTaskService: ActiveUsersBillingTaskService,
    logger: Logger
  ) {
    super({
      logger,
      billingTaskService,
      activeUsersBillingTaskService,
    });
  }
}
