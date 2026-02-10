import { MembershipRepository } from "@calcom/features/membership/repositories/MembershipRepository";
import type { MembershipRole } from "@calcom/prisma/enums";
import { TRPCError } from "@trpc/server";

export async function checkPermissions(args: {
  userId: number;
  teamId: number;
  allowedRoles: MembershipRole[];
}) {
  const { teamId, userId, allowedRoles } = args;

  const membershipRepository = new MembershipRepository();
  const membership = await membershipRepository.findUniqueByUserIdAndTeamId({ userId, teamId });

  if (!membership) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  if (!allowedRoles.includes(membership.role)) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
}
