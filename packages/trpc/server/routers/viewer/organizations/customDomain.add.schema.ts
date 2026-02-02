import { z } from "zod";

export const ZAddInputSchema = z.object({
  teamId: z.number(),
  slug: z.string().min(1).max(253),
});

export type TAddInputSchema = z.infer<typeof ZAddInputSchema>;
