import { z } from "zod";

export const ZUpdateSmtpConfigurationInputSchema = z.object({
  id: z.number(),
  fromEmail: z.string().email().optional(),
  fromName: z.string().min(1).optional(),
  smtpHost: z.string().min(1).optional(),
  smtpPort: z.coerce.number().int().min(1).max(65535).optional(),
  smtpSecure: z.boolean().optional(),
});

export type TUpdateSmtpConfigurationInput = z.infer<typeof ZUpdateSmtpConfigurationInputSchema>;
