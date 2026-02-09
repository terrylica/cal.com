import { bindModuleToClassOnToken, createModule, type ModuleLoader } from "@calcom/features/di/di";
import { ProrationEmailService } from "@calcom/features/ee/billing/service/proration/ProrationEmailService";

import { DI_TOKENS } from "../tokens";
import { monthlyProrationRepositoryModuleLoader } from "./MonthlyProrationRepository";

const thisModule = createModule();
const token = DI_TOKENS.PRORATION_EMAIL_SERVICE;
const moduleToken = DI_TOKENS.PRORATION_EMAIL_SERVICE_MODULE;

const loadModule = bindModuleToClassOnToken({
  module: thisModule,
  moduleToken,
  token,
  classs: ProrationEmailService,
  dep: monthlyProrationRepositoryModuleLoader,
});

export const prorationEmailServiceModuleLoader = {
  token,
  loadModule,
} satisfies ModuleLoader;

export type { ProrationEmailService };
