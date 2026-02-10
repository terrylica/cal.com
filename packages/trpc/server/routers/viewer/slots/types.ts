import { getScheduleSchemaObject } from "@calcom/features/availability/types/getSchedule.types";
import { z } from "zod";

// Re-export types for backward compatibility
export type {
  ContextForGetSchedule,
  GetScheduleOptions,
  TGetScheduleInputSchema,
} from "@calcom/features/availability/types/getSchedule.types";

export const getScheduleSchema = getScheduleSchemaObject
  .transform((val) => {
    // Need this so we can pass a single username in the query string form public API
    if (val.usernameList) {
      val.usernameList = Array.isArray(val.usernameList) ? val.usernameList : [val.usernameList];
    }
    if (!val.orgSlug) {
      val.orgSlug = null;
    }
    return val;
  })
  .refine(
    (data) => !!data.eventTypeId || (!!data.usernameList && !!data.eventTypeSlug),
    "You need to either pass an eventTypeId OR an usernameList/eventTypeSlug combination"
  )
  .refine(({ startTime, endTime }) => new Date(endTime).getTime() > new Date(startTime).getTime(), {
    message: "endTime must be after startTime",
    path: ["endTime"],
  });

export const reserveSlotSchema = z
  .object({
    eventTypeId: z.number().int(),
    // startTime ISOString
    slotUtcStartDate: z.string(),
    // endTime ISOString
    slotUtcEndDate: z.string(),
    _isDryRun: z.boolean().optional(),
  })
  .refine(
    (data) => !!data.eventTypeId || !!data.slotUtcStartDate || !!data.slotUtcEndDate,
    "Either slotUtcStartDate, slotUtcEndDate or eventTypeId should be filled in."
  );

export const removeSelectedSlotSchema = z.object({
  uid: z.string().nullable(),
});

export const ZGetScheduleInputSchema = getScheduleSchema;
