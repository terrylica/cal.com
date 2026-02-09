import { createContainer } from "@calcom/features/di/di";
import type { MonthlyProrationTeamRepository } from "@calcom/features/ee/billing/repository/proration/MonthlyProrationTeamRepository";

import { monthlyProrationTeamRepositoryModuleLoader } from "../modules/MonthlyProrationTeamRepository";

const container = createContainer();

export function getMonthlyProrationTeamRepository(): MonthlyProrationTeamRepository {
  monthlyProrationTeamRepositoryModuleLoader.loadModule(container);
  return container.get<MonthlyProrationTeamRepository>(monthlyProrationTeamRepositoryModuleLoader.token);
}
