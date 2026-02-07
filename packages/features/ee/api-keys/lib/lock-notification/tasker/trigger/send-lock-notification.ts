import { schemaTask } from "@trigger.dev/sdk";
import { lockNotificationTaskConfig } from "./config";
import { sendLockNotificationSchema } from "./schema";

export const sendLockNotificationTask = schemaTask({
  id: "lock-notification.send-lock-notification",
  ...lockNotificationTaskConfig,
  schema: sendLockNotificationSchema,
  run: async (payload) => {
    const { LockNotificationService } = await import("../../LockNotificationService");
    const service = new LockNotificationService();
    await service.sendLockNotification(payload);
    return { success: true };
  },
});
