import { createContainer } from "@calcom/features/di/di";
import type { ProrationEmailService } from "@calcom/features/ee/billing/service/proration/ProrationEmailService";

import { prorationEmailServiceModuleLoader } from "../modules/ProrationEmailService";

const container = createContainer();

export function getProrationEmailService(): ProrationEmailService {
  prorationEmailServiceModuleLoader.loadModule(container);
  return container.get<ProrationEmailService>(prorationEmailServiceModuleLoader.token);
}
