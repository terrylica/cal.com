import { createContainer } from "@calcom/features/di/di";

import {
  type CustomDomainService,
  moduleLoader as customDomainServiceModuleLoader,
} from "./CustomDomainService.module";

const customDomainServiceContainer = createContainer();

export function getCustomDomainService(): CustomDomainService {
  customDomainServiceModuleLoader.loadModule(customDomainServiceContainer);
  return customDomainServiceContainer.get<CustomDomainService>(customDomainServiceModuleLoader.token);
}
