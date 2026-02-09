import type { Params } from "app/_types";
import { _generateMetadata, getTranslate } from "app/_utils";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getServerSession } from "@calcom/features/auth/lib/getServerSession";
import { TeamRepository } from "@calcom/features/ee/teams/repositories/TeamRepository";
import SettingsHeader from "@calcom/features/settings/appDir/SettingsHeader";
import { prisma } from "@calcom/prisma";
import { UserPermissionRole } from "@calcom/prisma/enums";

import { buildLegacyRequest } from "@lib/buildLegacyCtx";

import LicenseRequired from "~/ee/common/components/LicenseRequired";
import { AdminTeamEditView } from "~/settings/admin/admin-team-edit-view";

const teamIdSchema = z.object({ id: z.coerce.number() });

export const generateMetadata = async ({ params }: { params: Params }) => {
  const input = teamIdSchema.safeParse(await params);
  if (!input.success) {
    return await _generateMetadata(
      (t) => t("editing_team"),
      (t) => t("admin_teams_edit_description"),
      undefined,
      undefined,
      "/settings/admin/teams/edit"
    );
  }

  const teamRepo = new TeamRepository(prisma);
  const team = await teamRepo.adminFindByIdIncludeMembers({ id: input.data.id });

  return await _generateMetadata(
    (t) => `${t("editing_team")}: ${team.name}`,
    (t) => t("admin_teams_edit_description"),
    undefined,
    undefined,
    `/settings/admin/teams/${input.data.id}/edit`
  );
};

const Page = async ({ params }: { params: Params }) => {
  const session = await getServerSession({ req: buildLegacyRequest(await headers(), await cookies()) });

  if (session?.user?.role !== UserPermissionRole.ADMIN) {
    return redirect("/settings/my-account/profile");
  }

  const input = teamIdSchema.safeParse(await params);

  if (!input.success) throw new Error("Invalid access");

  const teamRepo = new TeamRepository(prisma);
  const team = await teamRepo.adminFindByIdIncludeMembers({ id: input.data.id });

  const t = await getTranslate();

  return (
    <SettingsHeader
      title={`${t("editing_team")}: ${team.name}`}
      description={t("admin_teams_edit_description")}>
      <LicenseRequired>
        <AdminTeamEditView team={team} />
      </LicenseRequired>
    </SettingsHeader>
  );
};

export default Page;
