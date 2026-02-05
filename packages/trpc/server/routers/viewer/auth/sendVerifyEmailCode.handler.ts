import type { NextApiRequest } from "next";

import { sendEmailVerificationByCode } from "@calcom/features/auth/lib/verifyEmail";
import { shouldHideBrandingForEventUsingProfile } from "@calcom/features/profile/lib/hideBranding";
import { checkRateLimitAndThrowError } from "@calcom/lib/checkRateLimitAndThrowError";
import getIP from "@calcom/lib/getIP";
import { hashEmail, piiHasher } from "@calcom/lib/server/PiiHasher";
import { prisma } from "@calcom/prisma";

import type { TRPCContext } from "../../../createContext";
import type { TSendVerifyEmailCodeSchema } from "./sendVerifyEmailCode.schema";

type SendVerifyEmailCode = {
  input: TSendVerifyEmailCodeSchema;
  req: TRPCContext["req"] | undefined;
};

export const sendVerifyEmailCodeHandler = async ({ input, req }: SendVerifyEmailCode) => {
  const identifier = req ? piiHasher.hash(getIP(req as NextApiRequest)) : hashEmail(input.email);
  return sendVerifyEmailCode({ input, identifier });
};

async function getHideBrandingForEventType(eventTypeId: number): Promise<boolean> {
  const eventType = await prisma.eventType.findUnique({
    where: { id: eventTypeId },
    select: {
      id: true,
      team: {
        select: {
          hideBranding: true,
          parent: { select: { hideBranding: true } },
        },
      },
      owner: {
        select: {
          id: true,
          hideBranding: true,
          profiles: {
            select: {
              organizationId: true,
              organization: { select: { hideBranding: true } },
            },
          },
        },
      },
    },
  });

  if (!eventType) return false;

  return shouldHideBrandingForEventUsingProfile({
    eventTypeId: eventType.id,
    team: eventType.team
      ? {
          hideBranding: eventType.team.hideBranding,
          parent: eventType.team.parent,
        }
      : null,
    owner: eventType.owner
      ? {
          id: eventType.owner.id,
          hideBranding: eventType.owner.hideBranding,
          profile: eventType.owner.profiles?.[0]
            ? { organization: eventType.owner.profiles[0].organization }
            : null,
        }
      : null,
  });
}

export const sendVerifyEmailCode = async ({
  input,
  identifier,
}: {
  input: TSendVerifyEmailCodeSchema;
  identifier: string;
}) => {
  await checkRateLimitAndThrowError({
    rateLimitingType: "core",
    identifier: `sendVerifyEmailCode:${identifier}`,
  });

  const hideBranding = input.eventTypeId ? await getHideBrandingForEventType(input.eventTypeId) : false;

  return await sendEmailVerificationByCode({
    email: input.email,
    username: input.username,
    language: input.language,
    isVerifyingEmail: input.isVerifyingEmail,
    hideBranding,
  });
};
