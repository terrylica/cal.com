import { bindModuleToClassOnToken, createModule, type ModuleLoader } from "@calcom/features/di/di";
import { moduleLoader as prismaModuleLoader } from "@calcom/features/di/modules/Prisma";
import { SeatChangeLogRepository } from "@calcom/features/ee/billing/repository/seatChangeLogs/SeatChangeLogRepository";

import { DI_TOKENS } from "../tokens";

const thisModule = createModule();
const token = DI_TOKENS.SEAT_CHANGE_LOG_REPOSITORY;
const moduleToken = DI_TOKENS.SEAT_CHANGE_LOG_REPOSITORY_MODULE;

const loadModule = bindModuleToClassOnToken({
  module: thisModule,
  moduleToken,
  token,
  classs: SeatChangeLogRepository,
  dep: prismaModuleLoader,
});

export const seatChangeLogRepositoryModuleLoader: ModuleLoader = {
  token,
  loadModule,
};

export type { SeatChangeLogRepository };
