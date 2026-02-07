import { createContainer } from "@calcom/features/di/di";
import {
  type PrismaUserLockRepository,
  moduleLoader as userLockRepositoryModuleLoader,
} from "./PrismaUserLockRepository.module";

const userLockRepositoryContainer = createContainer();

export function getUserLockRepository(): PrismaUserLockRepository {
  userLockRepositoryModuleLoader.loadModule(userLockRepositoryContainer);
  return userLockRepositoryContainer.get<PrismaUserLockRepository>(userLockRepositoryModuleLoader.token);
}
