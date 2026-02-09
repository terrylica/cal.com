import { bindModuleToClassOnToken, createModule, type ModuleLoader } from "@calcom/features/di/di";
import { moduleLoader as featuresRepositoryModuleLoader } from "@calcom/features/di/modules/FeaturesRepository";
import { SeatBillingStrategyResolver } from "@calcom/features/ee/billing/service/seatBillingStrategy/SeatBillingStrategyResolver";
import { DI_TOKENS } from "../tokens";
import { billingPeriodServiceModuleLoader } from "./BillingPeriodService.module";
import { billingProviderServiceModuleLoader } from "./BillingProviderService";

const thisModule = createModule();
const token = DI_TOKENS.SEAT_BILLING_STRATEGY_RESOLVER;
const moduleToken = DI_TOKENS.SEAT_BILLING_STRATEGY_RESOLVER_MODULE;

const loadModule = bindModuleToClassOnToken({
  module: thisModule,
  moduleToken,
  token,
  classs: SeatBillingStrategyResolver,
  depsMap: {
    billingPeriodService: billingPeriodServiceModuleLoader,
    featuresRepository: featuresRepositoryModuleLoader,
    billingProviderService: billingProviderServiceModuleLoader,
  },
});

export const seatBillingStrategyResolverModuleLoader: ModuleLoader = {
  token,
  loadModule,
};

export type { SeatBillingStrategyResolver };
