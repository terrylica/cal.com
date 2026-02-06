import { UpgradeBannerForAttributes } from "@calcom/web/modules/billing/upgrade-banners/fullscreen/toOrgPlan";
import { _generateMetadata } from "app/_utils";

export const generateMetadata = async ({ params }: { params: Promise<{ id: string }> }) =>
  await _generateMetadata(
    (t) => t("attributes"),
    (t) => t("attributes_description"),
    undefined,
    undefined,
    `/settings/teams/${(await params).id}/attributes`
  );

const Page = async () => {
  return <UpgradeBannerForAttributes />;
};

export default Page;
