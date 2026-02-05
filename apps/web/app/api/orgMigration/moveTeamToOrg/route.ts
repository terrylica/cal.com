import { defaultResponderForAppDir } from "app/api/defaultResponderForAppDir";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getServerSession } from "@calcom/features/auth/lib/getServerSession";
import { getOrganizationRepository } from "@calcom/features/ee/organizations/di/OrganizationRepository.container";
import { HttpError } from "@calcom/lib/http-error";
import logger from "@calcom/lib/logger";
import { safeStringify } from "@calcom/lib/safeStringify";
import slugify from "@calcom/lib/slugify";
import { getTranslation } from "@calcom/lib/server/i18n";
import { getStringAsNumberRequiredSchema } from "@calcom/prisma/zod-utils";
import { CreationSource, UserPermissionRole } from "@calcom/prisma/enums";
import { createTeamsHandler } from "@calcom/trpc/server/routers/viewer/organizations/createTeams.handler";

const log = logger.getSubLogger({ prefix: ["moveTeamToOrg"] });

const getFormSchema = (t: (key: string) => string) => {
  return z.object({
    teamId: z.number().or(getStringAsNumberRequiredSchema(t)),
    targetOrgId: z.number().or(getStringAsNumberRequiredSchema(t)),
    teamSlugInOrganization: z.string(),
  });
};

async function postHandler(req: NextRequest) {
  const rawBody = await req.json();

  log.debug(
    "Moving team to org:",
    safeStringify({
      body: rawBody,
    })
  );

  const translate = await getTranslation("en", "common");
  const moveTeamToOrgSchema = getFormSchema(translate);

  const parsedBody = moveTeamToOrgSchema.safeParse(rawBody);

  const session = await getServerSession({ req });

  if (!session) {
    throw new HttpError({ statusCode: 403, message: "No session found" });
  }

  const isAdmin = session.user.role === UserPermissionRole.ADMIN;

  if (!parsedBody.success) {
    log.error("moveTeamToOrg failed:", safeStringify(parsedBody.error));
    throw new HttpError({ statusCode: 400, message: JSON.stringify(parsedBody.error) });
  }

  const { teamId, targetOrgId, teamSlugInOrganization } = parsedBody.data;
  const isAllowed = isAdmin;
  if (!isAllowed) {
    throw new HttpError({ statusCode: 403, message: "Not Authorized" });
  }

  const organizationRepository = getOrganizationRepository();
  const org = await organizationRepository.adminFindById({ id: targetOrgId });

  if (!org.members || org.members.length === 0) {
    throw new HttpError({ statusCode: 400, message: "Organization owner not found" });
  }

  const orgOwner = org.members[0].user;

  log.info(
    "Admin moving team to organization",
    safeStringify({
      adminUserId: session.user.id,
      adminEmail: session.user.email,
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

  return NextResponse.json({
    message: `Added team ${teamId} to Org: ${targetOrgId}`,
  });
}

export const POST = defaultResponderForAppDir(postHandler);
