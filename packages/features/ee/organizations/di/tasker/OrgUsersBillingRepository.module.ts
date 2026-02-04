import { bindModuleToClassOnToken, createModule, type ModuleLoader } from "@calcom/features/di/di";
import { moduleLoader as prismaModuleLoader } from "@calcom/features/di/modules/Prisma";
import { OrgUsersBillingRepository } from "@calcom/features/ee/organizations/repositories/OrgUsersBillingRepository";
import { PLATFORM_BILLING_TASKER_DI_TOKENS } from "./tokens";

const thisModule = createModule();
const token = PLATFORM_BILLING_TASKER_DI_TOKENS.ORG_USERS_BILLING_REPOSITORY;
const moduleToken = PLATFORM_BILLING_TASKER_DI_TOKENS.ORG_USERS_BILLING_REPOSITORY_MODULE;

const loadModule = bindModuleToClassOnToken({
  module: thisModule,
  moduleToken,
  token,
  classs: OrgUsersBillingRepository,
  dep: prismaModuleLoader,
});

export const moduleLoader = {
  token,
  loadModule,
} satisfies ModuleLoader;
