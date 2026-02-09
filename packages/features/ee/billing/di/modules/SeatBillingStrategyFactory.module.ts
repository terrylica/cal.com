import { bindModuleToClassOnToken, createModule, type ModuleLoader } from "@calcom/features/di/di";
import { moduleLoader as featuresRepositoryModuleLoader } from "@calcom/features/di/modules/FeaturesRepository";
import { SeatBillingStrategyFactory } from "@calcom/features/ee/billing/service/seatBillingStrategy/SeatBillingStrategyFactory";
import { DI_TOKENS } from "../tokens";
import { billingPeriodServiceModuleLoader } from "./BillingPeriodService.module";
import { billingProviderServiceModuleLoader } from "./BillingProviderService";
import { highWaterMarkRepositoryModuleLoader } from "./HighWaterMarkRepository";
import { highWaterMarkServiceModuleLoader } from "./HighWaterMarkService";
import { monthlyProrationServiceModuleLoader } from "./MonthlyProrationService";

const thisModule = createModule();
const token = DI_TOKENS.SEAT_BILLING_STRATEGY_FACTORY;
const moduleToken = DI_TOKENS.SEAT_BILLING_STRATEGY_FACTORY_MODULE;

const loadModule = bindModuleToClassOnToken({
  module: thisModule,
  moduleToken,
  token,
  classs: SeatBillingStrategyFactory,
  depsMap: {
    billingPeriodService: billingPeriodServiceModuleLoader,
    featuresRepository: featuresRepositoryModuleLoader,
    billingProviderService: billingProviderServiceModuleLoader,
    highWaterMarkRepository: highWaterMarkRepositoryModuleLoader,
    highWaterMarkService: highWaterMarkServiceModuleLoader,
    monthlyProrationService: monthlyProrationServiceModuleLoader,
  },
});

export const seatBillingStrategyFactoryModuleLoader: ModuleLoader = {
  token,
  loadModule,
};

export type { SeatBillingStrategyFactory };
