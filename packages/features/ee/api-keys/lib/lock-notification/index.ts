import logger from "@calcom/lib/logger";
import prisma from "@calcom/prisma";
import type { UserLockReason } from "@calcom/prisma/enums";
import { LockNotificationSyncTasker } from "./tasker/LockNotificationSyncTasker";
import { LockNotificationTasker } from "./tasker/LockNotificationTasker";
import { LockNotificationTriggerTasker } from "./tasker/LockNotificationTriggerTasker";

const SUPPORT_URL = "https://cal.com/support";

const REASON_LABELS: Record<UserLockReason, string> = {
  WATCHLIST_EMAIL_MATCH: "Your account matched our security watchlist based on email address",
  WATCHLIST_DOMAIN_MATCH: "Your account matched our security watchlist based on email domain",
  RATE_LIMIT_EXCEEDED: "Your account exceeded the allowed API rate limits",
  SPAM_WORKFLOW_BODY: "Spam content was detected in your workflow",
  MALICIOUS_URL_IN_WORKFLOW: "A malicious URL was detected in your workflow",
  ADMIN_ACTION: "An administrator has locked your account",
};

const log = logger.getSubLogger({ prefix: ["[lock-notification]"] });

function getLockNotificationTasker(): LockNotificationTasker {
  const triggerTasker = new LockNotificationTriggerTasker({ logger: log });
  const syncTasker = new LockNotificationSyncTasker(log);
  return new LockNotificationTasker({
    asyncTasker: triggerTasker,
    syncTasker,
    logger: log,
  });
}

export async function createUserLockAndNotify({
  userId,
  reason,
}: {
  userId: number;
  reason: UserLockReason;
}): Promise<void> {
  await prisma.userLock.create({
    data: {
      userId,
      reason,
    },
  });

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      email: true,
      name: true,
    },
  });

  const tasker = getLockNotificationTasker();
  try {
    await tasker.sendLockNotification({
      userId,
      userEmail: user.email,
      userName: user.name,
      reason: REASON_LABELS[reason],
      supportUrl: SUPPORT_URL,
    });
  } catch (err) {
    log.error("Failed to dispatch lock notification", {
      userId,
      reason,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
