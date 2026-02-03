import { z } from "zod";

export const ZSalesforceFieldsInputSchema = z.object({
  credentialId: z.number(),
  objectType: z.enum(["Event", "Contact", "Lead", "Account"]),
});

export type TSalesforceFieldsInputSchema = z.infer<typeof ZSalesforceFieldsInputSchema>;
