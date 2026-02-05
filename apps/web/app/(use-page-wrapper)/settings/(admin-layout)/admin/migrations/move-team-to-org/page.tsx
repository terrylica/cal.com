import SettingsHeader from "@calcom/features/settings/appDir/SettingsHeader";
import { _generateMetadata, getTranslate } from "app/_utils";
import MoveTeamToOrgView from "~/settings/admin/org-migrations/move-team-to-org-view";

export const generateMetadata = async () =>
  await _generateMetadata(
    () => "Organization Migration: Move a team",
    () => "Migrates a team to an organization",
    undefined,
    undefined,
    "/settings/admin/migrations/move-team-to-org"
  );

const Page = async () => {
  const t = await getTranslate();
  return (
    <SettingsHeader
      title={t("organization_migration_move_team")}
      description={t("organization_migration_move_team_description")}>
      <MoveTeamToOrgView />
    </SettingsHeader>
  );
};

export default Page;
