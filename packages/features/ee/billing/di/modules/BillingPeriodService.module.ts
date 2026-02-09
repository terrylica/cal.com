import { type Container, createModule, type ModuleLoader } from "@calcom/features/di/di";
import { moduleLoader as featuresRepositoryModuleLoader } from "@calcom/features/di/modules/FeaturesRepository";
import { BillingPeriodService } from "@calcom/features/ee/billing/service/billingPeriod/BillingPeriodService";
import { DI_TOKENS } from "../tokens";
import { billingPeriodRepositoryModuleLoader } from "./BillingPeriodRepository";

const thisModule = createModule();
const token = DI_TOKENS.BILLING_PERIOD_SERVICE;

thisModule.bind(token).toClass(BillingPeriodService, {
  repository: billingPeriodRepositoryModuleLoader.token,
  featuresRepository: featuresRepositoryModuleLoader.token,
});

export const billingPeriodServiceModuleLoader: ModuleLoader = {
  token,
  loadModule: (container: Container) => {
    billingPeriodRepositoryModuleLoader.loadModule(container);
    featuresRepositoryModuleLoader.loadModule(container);
    container.load(DI_TOKENS.BILLING_PERIOD_SERVICE_MODULE, thisModule);
  },
};

export type { BillingPeriodService };
