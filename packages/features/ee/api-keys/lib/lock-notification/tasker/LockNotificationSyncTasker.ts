import { nanoid } from "nanoid";
import type { Logger } from "tslog";
import type { ILockNotificationTasker } from "./types";

export class LockNotificationSyncTasker implements ILockNotificationTasker {
  constructor(private readonly logger: Logger<unknown>) {}

  async sendLockNotification(payload: Parameters<ILockNotificationTasker["sendLockNotification"]>[0]) {
    const runId = `sync_${nanoid(10)}`;
    this.logger.info(`[LockNotificationSyncTasker] sendLockNotification runId=${runId}`);
    const { LockNotificationService } = await import("../LockNotificationService");
    const service = new LockNotificationService();
    await service.sendLockNotification(payload);
    return { runId };
  }
}
