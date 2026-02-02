import { CredentialRepository } from "@calcom/features/credentials/repositories/CredentialRepository";
import { MembershipRepository } from "@calcom/features/membership/repositories/MembershipRepository";
import { ProfileRepository } from "@calcom/features/profile/repositories/ProfileRepository";
import HrmsManager from "@calcom/lib/hrmsManager/hrmsManager";
import logger from "@calcom/lib/logger";
import prisma from "@calcom/prisma";
import type { TrpcSessionUser } from "@calcom/trpc/server/types";

const log: ReturnType<typeof logger.getSubLogger> = logger.getSubLogger({
  prefix: [`[outOfOfficeReasons.handler]`],
});

interface OutOfOfficeReasonsHandlerOptions {
  ctx: {
    user: TrpcSessionUser;
  };
}

interface BaseOOOReason {
  emoji: string | null;
  reason: string;
  enabled: boolean;
}

export interface InternalOOOReason extends BaseOOOReason {
  source: "internal";
  id: number;
  userId: number | null;
}

export interface HrmsOOOReason extends BaseOOOReason {
  source: "hrms";
  hrmsSource: string;
  hrmsReasonId: string;
}

export type OOOReason = InternalOOOReason | HrmsOOOReason;

export interface OutOfOfficeReasonListResult {
  reasons: OOOReason[];
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

/**
 * Returns the list of OOO reasons.
 * If HRMS integration is installed, returns HRMS reasons.
 * Otherwise, returns Cal.com static reasons from the database.
 */
export async function outOfOfficeReasonList(
  options: OutOfOfficeReasonsHandlerOptions
): Promise<OutOfOfficeReasonListResult> {
  const { user } = options.ctx;

  if (!user) {
    const outOfOfficeReasons = await prisma.outOfOfficeReason.findMany({
      where: { enabled: true },
    });

    return {
      reasons: outOfOfficeReasons.map(
        (reason): InternalOOOReason => ({
          source: "internal",
          id: reason.id,
          emoji: reason.emoji,
          reason: reason.reason,
          userId: reason.userId,
          enabled: reason.enabled,
        })
      ),
    };
  }

  // Get the highest priority HRMS credential (org > team > user)
  const orgId = await ProfileRepository.findFirstOrganizationIdForUser({ userId: user.id });
  const teamIds = await MembershipRepository.findUserTeamIds({ userId: user.id });
  const hrmsCredential = await CredentialRepository.findFirstByAppSlug({
    userId: user.id,
    appSlug: "deel",
    orgId,
    teamIds,
  });

  if (hrmsCredential && user.email) {
    try {
      const hrmsManager = new HrmsManager(hrmsCredential);
      const reasons = await hrmsManager.listOOOReasons(user.email);

      const hrmsReasons: HrmsOOOReason[] = reasons.map((reason) => ({
        source: "hrms",
        emoji: null,
        reason: reason.name,
        enabled: true,
        hrmsSource: hrmsCredential.appId || "unknown",
        hrmsReasonId: reason.externalId,
      }));

      log.info("Successfully fetched HRMS OOO reasons", {
        appId: hrmsCredential.appId,
        count: reasons.length,
      });

      if (hrmsReasons.length > 0) {
        return {
          reasons: hrmsReasons,
        };
      }
    } catch (error) {
      log.error("Failed to fetch HRMS OOO reasons", {
        appId: hrmsCredential.appId,
        error: getErrorMessage(error),
      });
    }
  }

  const outOfOfficeReasons = await prisma.outOfOfficeReason.findMany({
    where: {
      enabled: true,
    },
  });

  const calComReasons: InternalOOOReason[] = outOfOfficeReasons.map((reason) => ({
    source: "internal",
    id: reason.id,
    emoji: reason.emoji,
    reason: reason.reason,
    userId: reason.userId,
    enabled: reason.enabled,
  }));

  return {
    reasons: calComReasons,
  };
}
