import { z } from "zod";

export const sendLockNotificationSchema = z.object({
  userId: z.number().int().positive(),
  userEmail: z.string().email(),
  userName: z.string().nullable(),
  reason: z.string(),
  supportUrl: z.string().url(),
});

export type SendLockNotificationPayload = z.infer<typeof sendLockNotificationSchema>;
