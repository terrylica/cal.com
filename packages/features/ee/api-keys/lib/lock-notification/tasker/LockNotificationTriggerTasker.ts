import type { ITaskerDependencies } from "@calcom/lib/tasker/types";
import type { ILockNotificationTasker } from "./types";

export class LockNotificationTriggerTasker implements ILockNotificationTasker {
  constructor(public readonly dependencies: ITaskerDependencies) {}

  async sendLockNotification(payload: Parameters<ILockNotificationTasker["sendLockNotification"]>[0]) {
    const { sendLockNotificationTask } = await import("./trigger/send-lock-notification");
    const handle = await sendLockNotificationTask.trigger(payload);
    return { runId: handle.id };
  }
}
