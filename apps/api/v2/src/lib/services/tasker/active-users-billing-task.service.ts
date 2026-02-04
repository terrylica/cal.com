import { ActiveUsersBillingTaskService as BaseActiveUsersBillingTaskService } from "@calcom/platform-libraries/organizations";
import { Injectable } from "@nestjs/common";
import { Logger } from "@/lib/logger.bridge";
import { OrganizationBillingTaskService } from "@/lib/services/tasker/organization-billing-task.service";
import { PlatformBillingTaskService } from "@/lib/services/tasker/platform-billing-task.service";
import { StripeBillingProviderService } from "@/lib/services/stripe-billing-provider.service";
import { OrganizationsRepository } from "@/modules/organizations/index/organizations.repository";

@Injectable()
export class ActiveUsersBillingTaskService extends BaseActiveUsersBillingTaskService {
  constructor(
    organizationRepository: OrganizationsRepository,
    platformBillingTaskService: PlatformBillingTaskService,
    organizationBillingTaskService: OrganizationBillingTaskService,
    billingProviderService: StripeBillingProviderService,
    logger: Logger
  ) {
    super({
      logger,
      organizationRepository,
      platformBillingTaskService,
      organizationBillingTaskService,
      billingProviderService,
    });
  }
}
