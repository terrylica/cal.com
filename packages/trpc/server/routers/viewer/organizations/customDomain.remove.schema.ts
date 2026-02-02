import { z } from "zod";

export const ZRemoveInputSchema = z.object({
  teamId: z.number(),
});

export type TRemoveInputSchema = z.infer<typeof ZRemoveInputSchema>;
