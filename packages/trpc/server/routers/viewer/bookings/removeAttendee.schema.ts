import { z } from "zod";

export type TRemoveAttendeeInputSchema = {
  bookingId: number;
  attendeeId: number;
};

export const ZRemoveAttendeeInputSchema: z.ZodType<TRemoveAttendeeInputSchema> = z.object({
  bookingId: z.number(),
  attendeeId: z.number(),
});
