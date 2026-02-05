import { _generateMetadata } from "app/_utils";
import SettingsHomeView from "~/settings/home/settings-home-view";

export const generateMetadata = async () =>
  await _generateMetadata(
    (t) => t("settings"),
    (t) => t("settings_home_description"),
    undefined,
    undefined,
    "/settings"
  );

const Page = () => {
  return <SettingsHomeView />;
};

export default Page;
