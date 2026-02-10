import { z } from "zod";

export const ZListTeamsPaginatedSchema = z.object({
  limit: z.number().min(1).max(100),
  offset: z.number().min(0).default(0),
  searchTerm: z.string().nullish(),
});

export type TListTeamsPaginatedSchema = z.infer<typeof ZListTeamsPaginatedSchema>;
