import SettingsHeader from "@calcom/features/settings/appDir/SettingsHeader";
import { _generateMetadata, getTranslate } from "app/_utils";
import LicenseRequired from "~/ee/common/components/LicenseRequired";
import AdminTeamsTable from "~/settings/admin/admin-teams-listing-view";

export const generateMetadata = async () =>
  await _generateMetadata(
    (t) => t("teams"),
    (t) => t("admin_teams_description"),
    undefined,
    undefined,
    "/settings/admin/teams"
  );

const Page = async () => {
  const t = await getTranslate();
  return (
    <SettingsHeader title={t("teams")} description={t("admin_teams_description")}>
      <LicenseRequired>
        <AdminTeamsTable />
      </LicenseRequired>
    </SettingsHeader>
  );
};

export default Page;
