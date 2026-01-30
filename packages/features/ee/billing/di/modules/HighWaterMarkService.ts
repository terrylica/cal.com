import { type Container, createModule, type ModuleLoader } from "@calcom/features/di/di";
import { moduleLoader as triggerDevLoggerServiceModule } from "@calcom/features/di/shared/services/triggerDevLogger.service";
import { HighWaterMarkService } from "@calcom/features/ee/billing/service/highWaterMark/HighWaterMarkService";

import { DI_TOKENS } from "../tokens";
import { billingProviderServiceModuleLoader } from "./BillingProviderService";

const highWaterMarkServiceModule = createModule();
const token = DI_TOKENS.HIGH_WATER_MARK_SERVICE;

highWaterMarkServiceModule.bind(token).toClass(HighWaterMarkService, []);

export const highWaterMarkServiceModuleLoader: ModuleLoader = {
  token,
  loadModule: (container: Container) => {
    // Load dependencies first
    triggerDevLoggerServiceModule.loadModule(container);
    billingProviderServiceModuleLoader.loadModule(container);

    // Then load this module
    container.load(DI_TOKENS.HIGH_WATER_MARK_SERVICE_MODULE, highWaterMarkServiceModule);
  },
};
