import { getOrganizationRepository } from "@calcom/features/ee/organizations/di/OrganizationRepository.container";
import { TeamRepository } from "@calcom/features/ee/teams/repositories/TeamRepository";
import { HttpError } from "@calcom/lib/http-error";
import logger from "@calcom/lib/logger";
import { safeStringify } from "@calcom/lib/safeStringify";
import slugify from "@calcom/lib/slugify";
import { CreationSource } from "@calcom/prisma/enums";
import { createTeamsHandler } from "@calcom/trpc/server/routers/viewer/organizations/createTeams.handler";

import type { TrpcSessionUser } from "../../../types";
import type { TMoveTeamToOrg } from "./moveTeamToOrg.schema";

const log = logger.getSubLogger({ prefix: ["moveTeamToOrg"] });

type MoveTeamToOrgOptions = {
  ctx: {
    user: NonNullable<TrpcSessionUser>;
    prisma: typeof import("@calcom/prisma").prisma;
  };
  input: TMoveTeamToOrg;
};

export const moveTeamToOrgHandler = async ({ ctx, input }: MoveTeamToOrgOptions) => {
  const { teamId, targetOrgId, teamSlugInOrganization } = input;

  log.debug(
    "Moving team to org:",
    safeStringify({
      teamId,
      targetOrgId,
      teamSlugInOrganization,
    })
  );

  const organizationRepository = getOrganizationRepository();
  const org = await organizationRepository.adminFindById({ id: targetOrgId });

  if (!org.members || org.members.length === 0) {
    throw new HttpError({ statusCode: 400, message: "Organization owner not found" });
  }

  const teamRepository = new TeamRepository(ctx.prisma);
  const team = await teamRepository.findById({ id: teamId });

  if (!team) {
    throw new HttpError({ statusCode: 404, message: "Team not found" });
  }

  const orgOwner = org.members[0].user;

  log.info(
    "Admin moving team to organization",
    safeStringify({
      adminUserId: ctx.user.id,
      adminEmail: ctx.user.email,
      orgOwnerId: orgOwner.id,
      orgOwnerEmail: orgOwner.email,
      teamId,
      targetOrgId,
    })
  );

  await createTeamsHandler({
    ctx: {
      user: {
        id: orgOwner.id,
        organizationId: targetOrgId,
      },
    },
    input: {
      teamNames: [],
      orgId: targetOrgId,
      moveTeams: [
        {
          id: teamId,
          newSlug: teamSlugInOrganization ? slugify(teamSlugInOrganization) : null,
          shouldMove: true,
        },
      ],
      creationSource: CreationSource.WEBAPP,
    },
  });

  return {
    message: `Added team ${teamId} to Org: ${targetOrgId}`,
    teamId,
    teamSlug: team.slug,
    organizationId: targetOrgId,
    organizationSlug: org.slug,
  };
};

export default moveTeamToOrgHandler;
