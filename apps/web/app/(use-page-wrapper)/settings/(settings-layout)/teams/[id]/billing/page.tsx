import SettingsHeader from "@calcom/features/settings/appDir/SettingsHeader";
import { _generateMetadata, getTranslate } from "app/_utils";
import BillingView from "~/settings/billing/billing-view";
import SeatBillingDebug from "~/settings/billing/components/SeatBillingDebug";

export const generateMetadata = async () =>
  await _generateMetadata(
    (t) => t("billing"),
    (t) => t("manage_billing_description"),
    undefined,
    undefined,
    "/settings/billing"
  );

const Page = async ({ params }: { params: Promise<{ id: string }> }) => {
  const t = await getTranslate();
  const { id } = await params;
  const teamId = parseInt(id, 10);

  return (
    <>
      <SettingsHeader
        title={t("billing")}
        description={t("manage_billing_description")}
        borderInShellHeader={false}>
        <BillingView />
      </SettingsHeader>
      <SeatBillingDebug teamId={teamId} />
    </>
  );
};

export default Page;
