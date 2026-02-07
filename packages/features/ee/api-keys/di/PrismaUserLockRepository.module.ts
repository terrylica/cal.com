import { bindModuleToClassOnToken, createModule, type ModuleLoader } from "@calcom/features/di/di";
import { moduleLoader as prismaModuleLoader } from "@calcom/features/di/modules/Prisma";
import { PrismaUserLockRepository } from "@calcom/features/ee/api-keys/repositories/PrismaUserLockRepository";
import { USER_LOCK_DI_TOKENS } from "./tokens";

const thisModule = createModule();
const token = USER_LOCK_DI_TOKENS.USER_LOCK_REPOSITORY;
const moduleToken = USER_LOCK_DI_TOKENS.USER_LOCK_REPOSITORY_MODULE;
const loadModule = bindModuleToClassOnToken({
  module: thisModule,
  moduleToken,
  token,
  classs: PrismaUserLockRepository,
  dep: prismaModuleLoader,
});

export const moduleLoader: ModuleLoader = {
  token,
  loadModule,
};

export type { PrismaUserLockRepository };
