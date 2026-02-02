import { z } from "zod";

export const ZUploadOnboardingImageInputSchema = z.object({
  image: z.string().min(1, "Image data is required"),
  isBanner: z.boolean().default(false),
});

export type TUploadOnboardingImageInputSchema = z.infer<typeof ZUploadOnboardingImageInputSchema>;
