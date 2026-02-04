import { createContainer } from "@calcom/features/di/di";
import { ActiveUsersBillingTaskService } from "@calcom/features/ee/organizations/lib/billing/tasker/ActiveUsersBillingTaskService";

import { moduleLoader as activeUsersBillingTaskServiceModuleLoader } from "./ActiveUsersBillingTaskService.module";

const container = createContainer();

export function getActiveUsersBillingTaskService(): ActiveUsersBillingTaskService {
  activeUsersBillingTaskServiceModuleLoader.loadModule(container);
  return container.get<ActiveUsersBillingTaskService>(activeUsersBillingTaskServiceModuleLoader.token);
}
