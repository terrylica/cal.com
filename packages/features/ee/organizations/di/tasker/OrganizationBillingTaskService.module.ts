import { bindModuleToClassOnToken, createModule, type ModuleLoader } from "@calcom/features/di/di";
import { OrganizationBillingTaskService } from "@calcom/features/ee/organizations/lib/billing/tasker/OrganizationBillingTaskService";
import { moduleLoader as orgUsersBillingRepositoryModuleLoader } from "./OrgUsersBillingRepository.module";
import { PLATFORM_BILLING_TASKER_DI_TOKENS } from "./tokens";

const thisModule = createModule();
const token = PLATFORM_BILLING_TASKER_DI_TOKENS.ORGANIZATION_BILLING_TASK_SERVICE;
const moduleToken = PLATFORM_BILLING_TASKER_DI_TOKENS.ORGANIZATION_BILLING_TASK_SERVICE_MODULE;

const loadModule = bindModuleToClassOnToken({
  module: thisModule,
  moduleToken,
  token,
  classs: OrganizationBillingTaskService,
  depsMap: {
    orgUsersBillingRepository: orgUsersBillingRepositoryModuleLoader,
  },
});

export const moduleLoader = {
  token,
  loadModule,
} satisfies ModuleLoader;
