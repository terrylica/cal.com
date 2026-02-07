import { getUserLockRepository } from "@calcom/features/ee/api-keys/di/PrismaUserLockRepository.container";
import { createUserLockAndNotify } from "@calcom/features/ee/api-keys/lib/lock-notification";
import logger from "@calcom/lib/logger";
import { UserLockReason } from "@calcom/prisma/enums";
import type { TrpcSessionUser } from "../../../types";
import type { TAdminLockUserAccountSchema } from "./lockUserAccount.schema";

const log = logger.getSubLogger({ prefix: ["[lockUserAccountHandler]"] });

type GetOptions = {
  ctx: {
    user: NonNullable<TrpcSessionUser>;
  };
  input: TAdminLockUserAccountSchema;
};

const lockUserAccountHandler = async ({ input }: GetOptions) => {
  const { userId, locked } = input;

  const userLockRepository = getUserLockRepository();
  await userLockRepository.updateLockedStatus({ userId, locked });

  if (locked) {
    try {
      await createUserLockAndNotify({
        userId,
        reason: UserLockReason.ADMIN_ACTION,
      });
    } catch (err) {
      log.error("Failed to create UserLock record for admin lock", {
        userId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return {
    success: true,
    userId,
    locked,
  };
};

export default lockUserAccountHandler;
