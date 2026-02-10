import type { IncomingMessage } from "node:http";
import { z } from "zod";

import { timeZoneSchema } from "@calcom/lib/dayjs/timeZone.schema";

const isValidDateString = (val: string) => !isNaN(Date.parse(val));

export const getScheduleSchemaObject = z.object({
  startTime: z.string().refine(isValidDateString, {
    message: "startTime must be a valid date string",
  }),
  endTime: z.string().refine(isValidDateString, {
    message: "endTime must be a valid date string",
  }),
  // Event type ID
  eventTypeId: z.coerce.number().int().optional(),
  // Event type slug
  eventTypeSlug: z.string().optional(),
  // invitee timezone
  timeZone: timeZoneSchema.optional(),
  // or list of users (for dynamic events)
  usernameList: z.array(z.string()).min(1).optional(),
  debug: z.boolean().optional(),
  // to handle event types with multiple duration options
  duration: z
    .string()
    .optional()
    .transform((val) => val && parseInt(val)),
  rescheduleUid: z.string().nullish(),
  // whether to do team event or user event
  isTeamEvent: z.boolean().optional().default(false),
  orgSlug: z.string().nullish(),
  teamMemberEmail: z.string().nullish(),
  routedTeamMemberIds: z.array(z.number()).nullish(),
  skipContactOwner: z.boolean().nullish(),
  rrHostSubsetIds: z.array(z.number()).nullish(),
  _enableTroubleshooter: z.boolean().optional(),
  _bypassCalendarBusyTimes: z.boolean().optional(),
  _silentCalendarFailures: z.boolean().optional(),
  routingFormResponseId: z.number().optional(),
  queuedFormResponseId: z.string().nullish(),
  email: z.string().nullish(),
});

export interface ContextForGetSchedule extends Record<string, unknown> {
  req?: (IncomingMessage & { cookies: Partial<{ [key: string]: string }> }) | undefined;
}

export type TGetScheduleInputSchema = z.infer<typeof getScheduleSchemaObject>;

export type GetScheduleOptions = {
  ctx?: ContextForGetSchedule;
  input: TGetScheduleInputSchema;
};
