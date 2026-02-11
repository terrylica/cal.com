import { PermissionCheckService } from "@calcom/features/pbac/services/permission-check.service";
import { MembershipRole } from "@calcom/prisma/enums";

import { TRPCError } from "@trpc/server";

export type { Invitee, UserWithMembership } from "@calcom/features/ee/teams/lib/inviteMemberUtils";
export {
  createMemberships,
  getTeamOrThrow,
  sendEmails,
  sendExistingUserTeamInviteEmails,
  sendSignupToOrganizationEmail,
} from "@calcom/features/ee/teams/lib/inviteMemberUtils";

export type { Invitation, TeamWithParent } from "@calcom/features/ee/teams/lib/inviteMembers";
export {
  canBeInvited,
  checkInputEmailIsValid,
  createNewUsersConnectToOrgIfExists,
  findUsersWithInviteStatus,
  getAutoJoinStatus,
  getOrgConnectionInfo,
  getOrgState,
  getUniqueInvitationsOrThrowIfEmpty,
  groupUsersByJoinability,
  handleExistingUsersInvites,
  handleNewUsersInvites,
  INVITE_STATUS,
} from "@calcom/features/ee/teams/lib/inviteMembers";

export async function ensureAtleastAdminPermissions({
  userId,
  teamId,
  isOrg,
}: {
  userId: number;
  teamId: number;
  isOrg?: boolean;
}) {
  const permissionCheckService = new PermissionCheckService();

  // Checks if the team they are inviting to IS the org. Not a child team
  // TODO: do some logic here to check if the user is inviting a NEW user to a team that ISNT in the same org
  const permission = isOrg ? "organization.invite" : "team.invite";
  const hasInvitePermission = await permissionCheckService.checkPermission({
    userId,
    teamId,
    permission,
    fallbackRoles: [MembershipRole.OWNER, MembershipRole.ADMIN],
  });

  if (!hasInvitePermission) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
}
