import { bindModuleToClassOnToken, createModule, type ModuleLoader } from "@calcom/features/di/di";
import { moduleLoader as featuresRepositoryModuleLoader } from "@calcom/features/di/modules/FeaturesRepository";
import { SeatChangeTrackingService } from "@calcom/features/ee/billing/service/seatTracking/SeatChangeTrackingService";

import { DI_TOKENS } from "../tokens";
import { highWaterMarkRepositoryModuleLoader } from "./HighWaterMarkRepository";
import { monthlyProrationTeamRepositoryModuleLoader } from "./MonthlyProrationTeamRepository";
import { seatChangeLogRepositoryModuleLoader } from "./SeatChangeLogRepository";

const thisModule = createModule();
const token = DI_TOKENS.SEAT_CHANGE_TRACKING_SERVICE;
const moduleToken = DI_TOKENS.SEAT_CHANGE_TRACKING_SERVICE_MODULE;

const loadModule = bindModuleToClassOnToken({
  module: thisModule,
  moduleToken,
  token,
  classs: SeatChangeTrackingService,
  depsMap: {
    repository: seatChangeLogRepositoryModuleLoader,
    highWaterMarkRepo: highWaterMarkRepositoryModuleLoader,
    teamRepo: monthlyProrationTeamRepositoryModuleLoader,
    featuresRepository: featuresRepositoryModuleLoader,
  },
});

export const seatChangeTrackingServiceModuleLoader: ModuleLoader = {
  token,
  loadModule,
};

export type { SeatChangeTrackingService };
