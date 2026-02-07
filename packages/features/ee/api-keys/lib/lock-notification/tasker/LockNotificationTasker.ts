import { Tasker } from "@calcom/lib/tasker/Tasker";
import type { Logger } from "tslog";
import type { LockNotificationSyncTasker } from "./LockNotificationSyncTasker";
import type { LockNotificationTriggerTasker } from "./LockNotificationTriggerTasker";
import type { ILockNotificationTasker, SendLockNotificationPayload } from "./types";

export interface LockNotificationTaskerDependencies {
  asyncTasker: LockNotificationTriggerTasker;
  syncTasker: LockNotificationSyncTasker;
  logger: Logger<unknown>;
}

export class LockNotificationTasker extends Tasker<ILockNotificationTasker> {
  constructor(dependencies: LockNotificationTaskerDependencies) {
    super(dependencies);
  }

  async sendLockNotification(payload: SendLockNotificationPayload): Promise<{ runId: string }> {
    return await this.dispatch("sendLockNotification", payload);
  }
}
