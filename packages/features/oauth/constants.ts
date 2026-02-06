import type { AccessScope } from "@calcom/prisma/enums";

export const OAUTH_SCOPES: AccessScope[] = [
  "EVENT_TYPE_READ",
  "EVENT_TYPE_WRITE",
  "BOOKING_READ",
  "BOOKING_WRITE",
  "SCHEDULE_READ",
  "SCHEDULE_WRITE",
  "PROFILE_READ",
];
