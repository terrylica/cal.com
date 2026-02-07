import { queue, type schemaTask } from "@trigger.dev/sdk";

type LockNotificationTaskConfig = Pick<Parameters<typeof schemaTask>[0], "machine" | "retry" | "queue">;

export const lockNotificationQueue = queue({
  name: "lock-notification",
  concurrencyLimit: 10,
});

export const lockNotificationTaskConfig: LockNotificationTaskConfig = {
  queue: lockNotificationQueue,
  machine: "small-1x",
  retry: {
    maxAttempts: 3,
    factor: 2,
    minTimeoutInMs: 1_000,
    maxTimeoutInMs: 30_000,
    randomize: true,
  },
};
