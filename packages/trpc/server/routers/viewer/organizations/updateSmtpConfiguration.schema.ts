import { stripCRLF } from "@calcom/lib/sanitizeCRLF";
import { z } from "zod";

export const ZUpdateSmtpConfigurationInputSchema = z.object({
  id: z.number(),
  fromEmail: z
    .string()
    .email()
    .optional()
    .transform((val) => val && stripCRLF(val)),
  fromName: z
    .string()
    .min(1)
    .optional()
    .transform((val) => val && stripCRLF(val)),
  smtpHost: z
    .string()
    .min(1)
    .optional()
    .transform((val) => val && stripCRLF(val)),
  smtpPort: z.coerce.number().int().min(1).max(65535).optional(),
  smtpUser: z.string().min(1).optional(),
  smtpPassword: z.string().min(1).optional(),
  smtpSecure: z.boolean().optional(),
});

export type TUpdateSmtpConfigurationInput = z.infer<typeof ZUpdateSmtpConfigurationInputSchema>;
