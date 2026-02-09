import { bindModuleToClassOnToken, createModule, type ModuleLoader } from "@calcom/features/di/di";
import { moduleLoader as prismaModuleLoader } from "@calcom/features/di/modules/Prisma";
import { BillingModelRepository } from "@calcom/features/ee/billing/service/billingModelStrategy/BillingModelRepository";

import { DI_TOKENS } from "../tokens";

const thisModule = createModule();
const token = DI_TOKENS.BILLING_MODEL_REPOSITORY;
const moduleToken = DI_TOKENS.BILLING_MODEL_REPOSITORY_MODULE;

const loadModule = bindModuleToClassOnToken({
  module: thisModule,
  moduleToken,
  token,
  classs: BillingModelRepository,
  dep: prismaModuleLoader,
});

export const billingModelRepositoryModuleLoader: ModuleLoader = {
  token,
  loadModule,
};

export type { BillingModelRepository };
