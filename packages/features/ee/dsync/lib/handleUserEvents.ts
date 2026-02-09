import type { DirectorySyncEvent, User } from "@boxyhq/saml-jackson";
import removeUserFromOrg from "@calcom/features/ee/dsync/lib/removeUserFromOrg";
import { UserRepository } from "@calcom/features/users/repositories/UserRepository";
import logger from "@calcom/lib/logger";
import { safeStringify } from "@calcom/lib/safeStringify";
import { getTranslation } from "@calcom/lib/server/i18n";
import prisma from "@calcom/prisma";
import { IdentityProvider } from "@calcom/prisma/enums";
import type { UserWithMembership } from "@calcom/trpc/server/routers/viewer/teams/inviteMember/utils";
import {
  getTeamOrThrow,
  sendExistingUserTeamInviteEmails,
  sendSignupToOrganizationEmail,
} from "@calcom/trpc/server/routers/viewer/teams/inviteMember/utils";
import { assignValueToUserInOrgBulk } from "./assignValueToUser";
import getAttributesFromScimPayload from "./getAttributesFromScimPayload";
import createUsersAndConnectToOrg from "./users/createUsersAndConnectToOrg";
import dSyncUserSelect from "./users/dSyncUserSelect";
import inviteExistingUserToOrg from "./users/inviteExistingUserToOrg";

const log = logger.getSubLogger({ prefix: ["handleUserEvents"] });

async function syncCustomAttributesToUser({
  event,
  userEmail,
  org,
  directoryId,
}: {
  event: DirectorySyncEvent;
  userEmail: string;
  org: {
    id: number;
  };
  directoryId: string;
}) {
  const user = await prisma.user.findUnique({
    where: {
      email: userEmail,
    },
    select: dSyncUserSelect,
  });

  if (!user) {
    log.error(`User not found in DB ${userEmail}. Skipping custom attributes sync.`);
    return;
  }

  const customAttributes = getAttributesFromScimPayload({ event, directoryId });
  await assignValueToUserInOrgBulk({
    orgId: org.id,
    userId: user.id,
    attributeLabelToValueMap: customAttributes,
    updater: {
      dsyncId: directoryId,
    },
  });
}

const handleUserEvents = async (event: DirectorySyncEvent, organizationId: number) => {
  const directoryId = event.directory_id;
  const eventData = event.data as User;
  const userEmail = eventData.email;
  log.info(
    safeStringify({
      action: event.event,
      orgId: organizationId,
      userEmail,
      directoryId,
      active: eventData.active,
    })
  );
  // Check if user exists in DB
  const user = await prisma.user.findUnique({
    where: {
      email: userEmail,
    },
    select: dSyncUserSelect,
  });

  const translation = await getTranslation(user?.locale || "en", "common");

  const org = await getTeamOrThrow(organizationId);

  if (!org) {
    throw new Error("Org not found");
  }

  if (user) {
    if (user.organizationId && user.organizationId !== org.id) {
      throw new Error("User belongs to another organization.");
    }
    if (eventData.active) {
      if (await new UserRepository(prisma).isAMemberOfOrganization({ user, organizationId })) {
        log.info(
          safeStringify({
            action: "user.attributes_sync",
            orgId: organizationId,
            userId: user.id,
            userEmail,
          })
        );
        await syncCustomAttributesToUser({
          event,
          userEmail,
          org,
          directoryId,
        });
      } else {
        log.info(
          safeStringify({
            action: "user.invited_to_org",
            orgId: organizationId,
            userId: user.id,
            userEmail,
          })
        );
        const addedUser = await inviteExistingUserToOrg({
          user: user as UserWithMembership,
          org,
          translation,
        });
        await sendExistingUserTeamInviteEmails({
          currentUserName: user.username,
          currentUserTeamName: org.name,
          existingUsersWithMemberships: [
            {
              ...addedUser,
              profile: null,
            },
          ],
          language: translation,
          isOrg: true,
          teamId: org.id,
          isAutoJoin: true,
          currentUserParentTeamName: org?.parent?.name,
          orgSlug: org.slug,
        });
      }
    } else {
      log.info(
        safeStringify({
          action: "user.removed_from_org",
          orgId: organizationId,
          userId: user.id,
          userEmail,
        })
      );
      await removeUserFromOrg({
        userId: user.id,
        orgId: organizationId,
      });
    }
    // If user is not in DB, create user and add to the org
  } else {
    log.info(
      safeStringify({
        action: "user.created_and_added_to_org",
        orgId: organizationId,
        userEmail,
      })
    );
    const createUsersAndConnectToOrgProps = {
      emailsToCreate: [userEmail],
      identityProvider: IdentityProvider.CAL,
      identityProviderId: null,
    };
    await createUsersAndConnectToOrg({
      createUsersAndConnectToOrgProps,
      org,
    });

    await sendSignupToOrganizationEmail({
      usernameOrEmail: userEmail,
      team: org,
      translation,
      inviterName: org.name,
      teamId: organizationId,
      isOrg: true,
    });

    await syncCustomAttributesToUser({
      event,
      userEmail,
      org,
      directoryId,
    });
  }
};

export default handleUserEvents;
