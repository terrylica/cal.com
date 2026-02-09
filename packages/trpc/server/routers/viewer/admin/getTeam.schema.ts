import { z } from "zod";

export const ZAdminGetTeamSchema = z.object({
  id: z.number(),
});

export type TAdminGetTeamSchema = z.infer<typeof ZAdminGetTeamSchema>;
