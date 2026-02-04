import { bindModuleToClassOnToken, createModule, type ModuleLoader } from "@calcom/features/di/di";
import { moduleLoader as loggerServiceModule } from "@calcom/features/di/shared/services/logger.service";
import { billingProviderServiceModuleLoader } from "@calcom/features/ee/billing/di/modules/BillingProviderService";
import { ActiveUsersBillingTaskService } from "@calcom/features/ee/organizations/lib/billing/tasker/ActiveUsersBillingTaskService";
import { moduleLoader as organizationRepositoryModuleLoader } from "../OrganizationRepository.module";
import { moduleLoader as organizationBillingTaskServiceModuleLoader } from "./OrganizationBillingTaskService.module";
import { moduleLoader as platformBillingTaskServiceModuleLoader } from "./PlatformOrganizationBillingTaskService.module";
import { PLATFORM_BILLING_TASKER_DI_TOKENS } from "./tokens";

const thisModule = createModule();
const token = PLATFORM_BILLING_TASKER_DI_TOKENS.ACTIVE_USERS_BILLING_TASK_SERVICE;
const moduleToken = PLATFORM_BILLING_TASKER_DI_TOKENS.ACTIVE_USERS_BILLING_TASK_SERVICE_MODULE;

const loadModule = bindModuleToClassOnToken({
  module: thisModule,
  moduleToken,
  token,
  classs: ActiveUsersBillingTaskService,
  depsMap: {
    logger: loggerServiceModule,
    organizationRepository: organizationRepositoryModuleLoader,
    platformBillingTaskService: platformBillingTaskServiceModuleLoader,
    organizationBillingTaskService: organizationBillingTaskServiceModuleLoader,
    billingProviderService: billingProviderServiceModuleLoader,
  },
});

export const moduleLoader = {
  token,
  loadModule,
} satisfies ModuleLoader;
