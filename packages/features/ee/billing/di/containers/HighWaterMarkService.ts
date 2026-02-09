import { createContainer } from "@calcom/features/di/di";
import type { HighWaterMarkService } from "@calcom/features/ee/billing/service/highWaterMark/HighWaterMarkService";

import { highWaterMarkServiceModuleLoader } from "../modules/HighWaterMarkService";

const container = createContainer();

export function getHighWaterMarkService(): HighWaterMarkService {
  highWaterMarkServiceModuleLoader.loadModule(container);
  return container.get<HighWaterMarkService>(highWaterMarkServiceModuleLoader.token);
}
