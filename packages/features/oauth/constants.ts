import {
  APPS_READ,
  APPS_WRITE,
  BOOKING_READ,
  BOOKING_WRITE,
  EVENT_TYPE_READ,
  EVENT_TYPE_WRITE,
  PROFILE_READ,
  PROFILE_WRITE,
  SCHEDULE_READ,
  SCHEDULE_WRITE,
} from "@calcom/platform-constants";
import type { AccessScope } from "@calcom/prisma/enums";

export const OAUTH_SCOPES: AccessScope[] = [
  "EVENT_TYPE_READ",
  "EVENT_TYPE_WRITE",
  "BOOKING_READ",
  "BOOKING_WRITE",
  "SCHEDULE_READ",
  "SCHEDULE_WRITE",
  "APPS_READ",
  "APPS_WRITE",
  "PROFILE_READ",
  "PROFILE_WRITE",
];

export const SCOPE_EXCEEDS_CLIENT_REGISTRATION_ERROR =
  "Requested scope exceeds the client's registered scopes";

export function parseScopeParam(scopeParam: string | null | undefined): string[] {
  if (!scopeParam) {
    return [];
  }
  return scopeParam.split(/[, ]+/).filter(Boolean);
}

export type NewAccessScope = Exclude<AccessScope, "READ_BOOKING" | "READ_PROFILE">;

export const SCOPE_TO_PERMISSION: Record<NewAccessScope, number> = {
  EVENT_TYPE_READ: EVENT_TYPE_READ,
  EVENT_TYPE_WRITE: EVENT_TYPE_WRITE,
  BOOKING_READ: BOOKING_READ,
  BOOKING_WRITE: BOOKING_WRITE,
  SCHEDULE_READ: SCHEDULE_READ,
  SCHEDULE_WRITE: SCHEDULE_WRITE,
  APPS_READ: APPS_READ,
  APPS_WRITE: APPS_WRITE,
  PROFILE_READ: PROFILE_READ,
  PROFILE_WRITE: PROFILE_WRITE,
};

export const PERMISSION_TO_SCOPE: Record<number, NewAccessScope> = {
  [EVENT_TYPE_READ]: "EVENT_TYPE_READ",
  [EVENT_TYPE_WRITE]: "EVENT_TYPE_WRITE",
  [BOOKING_READ]: "BOOKING_READ",
  [BOOKING_WRITE]: "BOOKING_WRITE",
  [SCHEDULE_READ]: "SCHEDULE_READ",
  [SCHEDULE_WRITE]: "SCHEDULE_WRITE",
  [APPS_READ]: "APPS_READ",
  [APPS_WRITE]: "APPS_WRITE",
  [PROFILE_READ]: "PROFILE_READ",
  [PROFILE_WRITE]: "PROFILE_WRITE",
};
