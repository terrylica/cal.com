import { v4 as uuidv4 } from "uuid";

import { resizeBase64Image } from "@calcom/lib/server/resizeBase64Image";
import { prisma } from "@calcom/prisma";

import type { TrpcSessionUser } from "../../../types";
import type { TUploadOnboardingImageInputSchema } from "./uploadOnboardingImage.schema";

type UploadOnboardingImageOptions = {
  ctx: {
    user: NonNullable<TrpcSessionUser>;
  };
  input: TUploadOnboardingImageInputSchema;
};

/**
 * Uploads an onboarding image (logo or banner) temporarily using the user's ID.
 * This allows images to be uploaded before the organization is created,
 * avoiding the "Body exceeded" error from large base64 payloads.
 *
 * The image is stored in the Avatar table with:
 * - teamId: 0 (no team yet)
 * - userId: current user's ID
 * - isBanner: true for banners, false for logos
 *
 * After the organization is created, the backend will re-upload the images
 * with the proper organization ID via uploadOrganizationBrandAssets.
 */
export const uploadOnboardingImageHandler = async ({ ctx, input }: UploadOnboardingImageOptions) => {
  const { user } = ctx;
  const { image, isBanner } = input;

  const maxSize = isBanner ? 1500 : 512;
  const resizedImage = await resizeBase64Image(image, { maxSize });

  const objectKey = uuidv4();

  await prisma.avatar.upsert({
    where: {
      teamId_userId_isBanner: {
        teamId: 0,
        userId: user.id,
        isBanner,
      },
    },
    create: {
      teamId: 0,
      userId: user.id,
      data: resizedImage,
      objectKey,
      isBanner,
    },
    update: {
      data: resizedImage,
      objectKey,
    },
  });

  return {
    url: `/api/avatar/${objectKey}.png`,
  };
};

export default uploadOnboardingImageHandler;
