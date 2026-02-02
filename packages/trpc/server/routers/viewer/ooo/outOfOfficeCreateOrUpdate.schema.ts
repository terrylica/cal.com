import { z } from "zod";

const ZInternalReason = z.object({
  source: z.literal("internal"),
  id: z.number(),
});

const ZHrmsReason = z.object({
  source: z.literal("hrms"),
  id: z.string(),
  name: z.string(),
});

export const ZSelectedReason = z.discriminatedUnion("source", [ZInternalReason, ZHrmsReason]);

export type TSelectedReason = z.infer<typeof ZSelectedReason>;

export const ZOutOfOfficeInputSchema = z.object({
  uuid: z.string().nullish(),
  forUserId: z.number().nullish(),
  dateRange: z.object({
    startDate: z.date(),
    endDate: z.date(),
  }),
  startDateOffset: z.number(),
  endDateOffset: z.number(),
  toTeamUserId: z.number().nullable(),
  selectedReason: ZSelectedReason,
  notes: z.string().nullable().optional(),
  showNotePublicly: z.boolean().optional(),
});

export type TOutOfOfficeInputSchema = z.infer<typeof ZOutOfOfficeInputSchema>;
