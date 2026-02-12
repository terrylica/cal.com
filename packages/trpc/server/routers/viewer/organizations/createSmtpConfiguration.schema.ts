import { stripCRLF } from "@calcom/lib/sanitizeCRLF";
import { z } from "zod";

export const ZCreateSmtpConfigurationInputSchema = z.object({
  fromEmail: z.string().email().transform(stripCRLF),
  fromName: z.string().min(1).transform(stripCRLF),
  smtpHost: z.string().min(1).transform(stripCRLF),
  smtpPort: z.coerce.number().int().min(1).max(65535),
  smtpUser: z.string().min(1),
  smtpPassword: z.string().min(1),
  smtpSecure: z.boolean().default(true),
});

export type TCreateSmtpConfigurationInput = z.infer<typeof ZCreateSmtpConfigurationInputSchema>;
