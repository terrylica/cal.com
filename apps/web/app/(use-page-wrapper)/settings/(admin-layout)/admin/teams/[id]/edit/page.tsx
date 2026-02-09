import SettingsHeader from "@calcom/features/settings/appDir/SettingsHeader";
import { prisma } from "@calcom/prisma";
import type { Params } from "app/_types";
import { _generateMetadata, getTranslate } from "app/_utils";
import { z } from "zod";
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

  const team = await prisma.team.findUniqueOrThrow({
    where: { id: input.data.id },
    select: { name: true },
  });

  return await _generateMetadata(
    (t) => `${t("editing_team")}: ${team.name}`,
    (t) => t("admin_teams_edit_description"),
    undefined,
    undefined,
    `/settings/admin/teams/${input.data.id}/edit`
  );
};

const Page = async ({ params }: { params: Params }) => {
  const input = teamIdSchema.safeParse(await params);

  if (!input.success) throw new Error("Invalid access");

  const team = await prisma.team.findUniqueOrThrow({
    where: { id: input.data.id },
    select: {
      id: true,
      name: true,
      slug: true,
      bio: true,
      logoUrl: true,
      hideBranding: true,
      hideBookATeamMember: true,
      isPrivate: true,
      timeZone: true,
      weekStart: true,
      timeFormat: true,
      theme: true,
      brandColor: true,
      darkBrandColor: true,
      parentId: true,
      isOrganization: true,
      parent: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
      members: {
        select: {
          id: true,
          role: true,
          accepted: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              username: true,
            },
          },
        },
      },
    },
  });

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
