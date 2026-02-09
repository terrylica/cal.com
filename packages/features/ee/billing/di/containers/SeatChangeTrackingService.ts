import { createContainer } from "@calcom/features/di/di";

import { seatChangeTrackingServiceModuleLoader } from "../modules/SeatChangeTrackingService";

const container = createContainer();

export function getSeatChangeTrackingService() {
  seatChangeTrackingServiceModuleLoader.loadModule(container);
  return container.get<
    import("@calcom/features/ee/billing/service/seatTracking/SeatChangeTrackingService").SeatChangeTrackingService
  >(seatChangeTrackingServiceModuleLoader.token);
}
