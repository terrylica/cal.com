import logger from "@calcom/lib/logger";
import type { SendLockNotificationPayload } from "./tasker/types";

const log = logger.getSubLogger({ prefix: ["[LockNotificationService]"] });

export class LockNotificationService {
  async sendLockNotification(payload: SendLockNotificationPayload): Promise<void> {
    const { default: AccountLockedEmail } = await import("@calcom/emails/templates/account-locked-email");

    log.info(`Sending lock notification email to userId=${payload.userId}`, {
      email: payload.userEmail,
      reason: payload.reason,
    });

    const email = new AccountLockedEmail({
      user: {
        name: payload.userName,
        email: payload.userEmail,
      },
      reason: payload.reason,
      supportUrl: payload.supportUrl,
    });

    await email.sendEmail();

    log.info(`Lock notification email sent to userId=${payload.userId}`);
  }
}
