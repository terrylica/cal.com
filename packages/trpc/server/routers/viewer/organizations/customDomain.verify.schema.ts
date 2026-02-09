import { z } from "zod";

export const ZVerifyInputSchema = z.object({
  teamId: z.number(),
});

export type TVerifyInputSchema = z.infer<typeof ZVerifyInputSchema>;
