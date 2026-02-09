import { z } from "zod";

export const ZAdminUpdateTeamSchema = z.object({
  id: z.number(),
  name: z.string().min(1).optional(),
  slug: z.string().min(1).optional(),
  bio: z.string().nullish(),
  hideBranding: z.boolean().optional(),
  hideBookATeamMember: z.boolean().optional(),
  isPrivate: z.boolean().optional(),
  timeZone: z.string().optional(),
  weekStart: z.string().optional(),
  timeFormat: z.number().nullish(),
  theme: z.string().nullish(),
  brandColor: z.string().nullish(),
  darkBrandColor: z.string().nullish(),
});

export type TAdminUpdateTeamSchema = z.infer<typeof ZAdminUpdateTeamSchema>;
