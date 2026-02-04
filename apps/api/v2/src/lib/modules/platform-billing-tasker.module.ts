import { Module, Scope } from "@nestjs/common";
import { Logger } from "@/lib/logger.bridge";
import { ManagedUsersBillingRepository } from "@/lib/repositories/managed-users-billing.repository";
import { OrgUsersBillingRepository } from "@/lib/repositories/org-users-billing.repository";
import { PrismaPlatformBillingRepository } from "@/lib/repositories/prisma-platform-billing.repository";
import { StripeBillingProviderService } from "@/lib/services/stripe-billing-provider.service";
import { ActiveUsersBillingTaskService } from "@/lib/services/tasker/active-users-billing-task.service";
import { OrganizationBillingTaskService } from "@/lib/services/tasker/organization-billing-task.service";
import { PlatformBillingSyncTaskerService } from "@/lib/services/tasker/platform-billing-sync-tasker.service";
import { PlatformBillingTaskService } from "@/lib/services/tasker/platform-billing-task.service";
import { PlatformBillingTasker } from "@/lib/services/tasker/platform-billing-tasker.service";
import { PlatformBillingTriggerTaskerService } from "@/lib/services/tasker/platform-billing-trigger-tasker.service";
import { OrganizationsModule } from "@/modules/organizations/organizations.module";
import { PrismaModule } from "@/modules/prisma/prisma.module";
import { StripeModule } from "@/modules/stripe/stripe.module";

@Module({
  imports: [PrismaModule, StripeModule, OrganizationsModule],
  providers: [
    PrismaPlatformBillingRepository,
    ManagedUsersBillingRepository,
    OrgUsersBillingRepository,
    StripeBillingProviderService,
    {
      provide: Logger,
      useFactory: () => {
        return new Logger();
      },
      scope: Scope.TRANSIENT,
    },
    PlatformBillingTaskService,
    OrganizationBillingTaskService,
    ActiveUsersBillingTaskService,
    PlatformBillingSyncTaskerService,
    PlatformBillingTriggerTaskerService,
    PlatformBillingTasker,
  ],
  exports: [PlatformBillingTasker],
})
export class PlatformBillingTaskerModule {}
