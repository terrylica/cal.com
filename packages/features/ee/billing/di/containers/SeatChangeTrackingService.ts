import { createContainer } from "@calcom/features/di/di";
import type { SeatChangeTrackingService } from "@calcom/features/ee/billing/service/seatTracking/SeatChangeTrackingService";

import { seatChangeTrackingServiceModuleLoader } from "../modules/SeatChangeTrackingService";
import { DI_TOKENS } from "../tokens";

const container = createContainer();

export function getSeatChangeTrackingService(): SeatChangeTrackingService {
  seatChangeTrackingServiceModuleLoader.loadModule(container);
  return container.get<SeatChangeTrackingService>(DI_TOKENS.SEAT_CHANGE_TRACKING_SERVICE);
}
