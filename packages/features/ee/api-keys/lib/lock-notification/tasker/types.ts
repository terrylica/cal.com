export interface SendLockNotificationPayload {
  userId: number;
  userEmail: string;
  userName: string | null;
  reason: string;
  supportUrl: string;
}

export interface ILockNotificationTasker {
  sendLockNotification(payload: SendLockNotificationPayload): Promise<{ runId: string }>;
}
