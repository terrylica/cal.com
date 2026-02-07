import { createUserLockAndNotify } from "@calcom/features/ee/api-keys/lib/lock-notification";
import { UserRepository } from "@calcom/features/users/repositories/UserRepository";
import { sentrySpan } from "@calcom/features/watchlist/lib/telemetry";
import { checkIfEmailIsBlockedInWatchlistController } from "@calcom/features/watchlist/operations/check-if-email-in-watchlist.controller";
import { hashPassword } from "@calcom/lib/auth/hashPassword";
import logger from "@calcom/lib/logger";
import slugify from "@calcom/lib/slugify";
import prisma from "@calcom/prisma";
import {
  type CreationSource,
  type IdentityProvider,
  UserLockReason,
  type UserPermissionRole,
} from "@calcom/prisma/enums";

interface CreateUserInput {
  email: string;
  username: string;
  name?: string | null;
  password?: string;
  brandColor?: string;
  darkBrandColor?: string;
  hideBranding?: boolean;
  weekStart?: string;
  timeZone?: string;
  theme?: string | null;
  timeFormat?: number;
  locale?: string;
  avatar?: string;
  organizationId?: number | null;
  creationSource: CreationSource;
  role?: UserPermissionRole;
  emailVerified?: Date;
  identityProvider?: IdentityProvider;
}

const log = logger.getSubLogger({ prefix: ["[userCreationService]"] });

export class UserCreationService {
  static async createUser({ data }: { data: CreateUserInput }) {
    const { email, password, username } = data;

    const shouldLockByDefault = await checkIfEmailIsBlockedInWatchlistController({
      email,
      organizationId: data.organizationId ?? undefined,
      span: sentrySpan,
    });

    const hashedPassword = password ? await hashPassword(password) : null;

    const userRepo = new UserRepository(prisma);
    const user = await userRepo.create({
      ...data,
      username: slugify(username),
      ...(hashedPassword && { hashedPassword }),
      organizationId: data?.organizationId ?? null,
      locked: shouldLockByDefault,
    });

    log.info(`Created user: ${user.id} with locked status of ${user.locked}`);

    if (user.locked) {
      try {
        await createUserLockAndNotify({
          userId: user.id,
          reason: UserLockReason.WATCHLIST_EMAIL_MATCH,
        });
      } catch (err) {
        log.error("Failed to create UserLock record for watchlist lock", {
          userId: user.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    const { locked: _locked, ...restUser } = user;

    return restUser;
  }
}
