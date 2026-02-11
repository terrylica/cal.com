import { getOrgFullOrigin } from "@calcom/features/ee/organizations/lib/orgDomains";
import { CreditService } from "@calcom/features/ee/billing/credit-service";
import stripe from "@calcom/features/ee/payments/server/stripe";
import { PermissionCheckService } from "@calcom/features/pbac/services/permission-check.service";
import { UserRepository } from "@calcom/features/users/repositories/UserRepository";
import logger from "@calcom/lib/logger";
import { ErrorWithCode } from "@calcom/lib/errors";
import { safeStringify } from "@calcom/lib/safeStringify";
import slugify from "@calcom/lib/slugify";
import { prisma } from "@calcom/prisma";
import type { Prisma } from "@calcom/prisma/client";
import type { CreationSource } from "@calcom/prisma/enums";
import { MembershipRole, RedirectType } from "@calcom/prisma/enums";
import { teamMetadataSchema, teamMetadataStrictSchema } from "@calcom/prisma/zod-utils";

import { inviteMembersWithNoInviterPermissionCheck } from "@calcom/features/ee/teams/lib/inviteMembers";

type CreateTeamsOptions = {
  ctx: {
    user: {
      id: number;
      organizationId: number | null;
    };
  };
  input: {
    orgId: number;
    teamNames: string[];
    moveTeams: { id: number; shouldMove: boolean; newSlug?: string | null }[];
    creationSource: CreationSource;
  };
};

const log = logger.getSubLogger({ prefix: ["features/organizations/createTeams"] });

export const createTeams = async ({ ctx, input }: CreateTeamsOptions) => {
  const organizationOwner = ctx.user;
  const { orgId, moveTeams, creationSource } = input;

  const teamNames = input.teamNames.filter((name) => name.trim().length > 0);

  if (orgId !== organizationOwner.organizationId) {
    log.error("User is not the owner of the organization", safeStringify({ orgId, organizationOwner }));
    throw ErrorWithCode.Factory.Forbidden("not_authorized");
  }

  const permissionCheckService = new PermissionCheckService();
  const hasPermission = await permissionCheckService.checkPermission({
    userId: organizationOwner.id,
    teamId: orgId,
    permission: "team.create",
    fallbackRoles: [MembershipRole.OWNER, MembershipRole.ADMIN],
  });

  if (!hasPermission) {
    log.error(
      "User is not authorized to create teams in the organization",
      safeStringify({ orgId, organizationOwner })
    );
    throw ErrorWithCode.Factory.Forbidden("not_authorized");
  }

  const organization = await prisma.team.findUnique({
    where: { id: orgId },
    select: { slug: true, id: true, metadata: true },
  });

  if (!organization) throw ErrorWithCode.Factory.BadRequest("no_organization_found");

  const parseTeams = teamMetadataSchema.safeParse(organization?.metadata);

  if (!parseTeams.success) {
    throw ErrorWithCode.Factory.BadRequest("invalid_organization_metadata");
  }

  const metadata = parseTeams.success ? parseTeams.data : undefined;

  if (!metadata?.requestedSlug && !organization?.slug) {
    throw ErrorWithCode.Factory.BadRequest("no_organization_slug");
  }

  const [teamSlugs, userSlugs] = [
    await prisma.team.findMany({ where: { parentId: orgId }, select: { slug: true } }),
    await new UserRepository(prisma).findManyByOrganization({ organizationId: orgId }),
  ];

  const existingSlugs = teamSlugs
    .flatMap((ts) => ts.slug ?? [])
    .concat(userSlugs.flatMap((us) => us.username ?? []));

  const slugifiedNameSet = new Set(teamNames.map((item) => slugify(item)));
  const duplicatedSlugs = new Set(existingSlugs.filter((slug) => slugifiedNameSet.has(slug)));

  for (const team of moveTeams.filter((team) => team.shouldMove)) {
    await moveTeam({
      teamId: team.id,
      newSlug: team.newSlug,
      org: {
        ...organization,
        ownerId: organizationOwner.id,
      },
      creationSource,
    });
  }

  if (duplicatedSlugs.size === teamNames.length) {
    return { duplicatedSlugs: [...duplicatedSlugs] } as const;
  }

  await prisma.$transaction(
    teamNames.flatMap((name) => {
      if (!duplicatedSlugs.has(slugify(name))) {
        return prisma.team.create({
          data: {
            name,
            parentId: orgId,
            slug: slugify(name),
            members: { create: { userId: ctx.user.id, role: MembershipRole.OWNER, accepted: true } },
          },
        });
      } else {
        return [] as const;
      }
    })
  );

  return { duplicatedSlugs: [...duplicatedSlugs] } as const;
};

async function moveTeam({
  teamId,
  newSlug,
  org,
  creationSource,
}: {
  teamId: number;
  newSlug?: string | null;
  org: { id: number; slug: string | null; ownerId: number; metadata: Prisma.JsonValue };
  creationSource: CreationSource;
}) {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: {
      id: true,
      slug: true,
      metadata: true,
      parent: { select: { id: true, isPlatform: true } },
      members: {
        select: { role: true, userId: true, user: { select: { email: true } } },
      },
    },
  });

  if (!team) {
    log.warn(`Team with id: ${teamId} not found. Skipping migration.`, {
      teamId,
      orgId: org.id,
      orgSlug: org.slug,
    });
    return;
  }

  if (team.parent?.isPlatform) {
    log.info(
      "Team belongs to a platform organization. Not moving to regular organization.",
      safeStringify({ teamId, newSlug, org, oldSlug: team.slug, platformOrgId: team.parent.id })
    );
    return;
  }
  log.info("Moving team", safeStringify({ teamId, newSlug, oldSlug: team.slug }));

  newSlug = newSlug ?? team.slug;
  const orgMetadata = teamMetadataSchema.parse(org.metadata);
  try {
    await prisma.team.update({ where: { id: teamId }, data: { slug: newSlug, parentId: org.id } });

    const creditService = new CreditService();
    await creditService.moveCreditsFromTeamToOrg({ teamId, orgId: org.id });
  } catch (error) {
    log.error(
      "Error while moving team to organization",
      safeStringify(error),
      safeStringify({ teamId, newSlug, orgId: org.id })
    );
    throw error;
  }

  const invitableMembers = team.members.filter((m) => m.userId !== org.ownerId).map((membership) => ({
    usernameOrEmail: membership.user.email,
    role: membership.role,
  }));

  if (invitableMembers.length) {
    await inviteMembersWithNoInviterPermissionCheck({
      orgSlug: org.slug,
      invitations: invitableMembers,
      creationSource,
      language: "en",
      inviterName: null,
      teamId: org.id,
      isDirectUserAction: false,
    });
  }

  await addTeamRedirect({ oldTeamSlug: team.slug, teamSlug: newSlug, orgSlug: org.slug || (orgMetadata?.requestedSlug ?? null) });

  const subscriptionId = getSubscriptionId(team.metadata);
  if (subscriptionId) {
    await tryToCancelSubscription(subscriptionId);
  }
}

async function tryToCancelSubscription(subscriptionId: string) {
  try {
    log.debug("Canceling stripe subscription", safeStringify({ subscriptionId }));
    return await stripe.subscriptions.cancel(subscriptionId);
  } catch (error) {
    log.error("Error while cancelling stripe subscription", error);
  }
}

function getSubscriptionId(metadata: Prisma.JsonValue) {
  const parsedMetadata = teamMetadataStrictSchema.safeParse(metadata);
  if (parsedMetadata.success) {
    const subscriptionId = parsedMetadata.data?.subscriptionId;
    if (!subscriptionId) {
      log.warn("No subscriptionId found in team metadata", safeStringify({ metadata, parsedMetadata }));
    }
    return subscriptionId;
  } else {
    log.warn(`There has been an error`, parsedMetadata.error);
  }
}

async function addTeamRedirect({
  oldTeamSlug,
  teamSlug,
  orgSlug,
}: {
  oldTeamSlug: string | null;
  teamSlug: string | null;
  orgSlug: string | null;
}) {
  logger.info(`Adding redirect for team: ${oldTeamSlug} -> ${teamSlug}`);
  if (!oldTeamSlug) {
    logger.warn(`No oldSlug for team. Not adding the redirect`);
    return;
  }
  if (!teamSlug) {
    throw ErrorWithCode.Factory.BadRequest("No slug for team. Not adding the redirect");
  }
  if (!orgSlug) {
    logger.warn(`No slug for org. Not adding the redirect`);
    return;
  }
  const orgUrlPrefix = getOrgFullOrigin(orgSlug);

  await prisma.tempOrgRedirect.upsert({
    where: { from_type_fromOrgId: { type: RedirectType.Team, from: oldTeamSlug, fromOrgId: 0 } },
    create: { type: RedirectType.Team, from: oldTeamSlug, fromOrgId: 0, toUrl: `${orgUrlPrefix}/${teamSlug}` },
    update: { toUrl: `${orgUrlPrefix}/${teamSlug}` },
  });
}
