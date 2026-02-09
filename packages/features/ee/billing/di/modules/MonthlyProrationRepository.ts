import { bindModuleToClassOnToken, createModule, type ModuleLoader } from "@calcom/features/di/di";
import { moduleLoader as prismaModuleLoader } from "@calcom/features/di/modules/Prisma";
import { MonthlyProrationRepository } from "@calcom/features/ee/billing/repository/proration/MonthlyProrationRepository";

import { DI_TOKENS } from "../tokens";

const thisModule = createModule();
const token = DI_TOKENS.MONTHLY_PRORATION_REPOSITORY;
const moduleToken = DI_TOKENS.MONTHLY_PRORATION_REPOSITORY_MODULE;

const loadModule = bindModuleToClassOnToken({
  module: thisModule,
  moduleToken,
  token,
  classs: MonthlyProrationRepository,
  dep: prismaModuleLoader,
});

export const monthlyProrationRepositoryModuleLoader: ModuleLoader = {
  token,
  loadModule,
};

export type { MonthlyProrationRepository };
