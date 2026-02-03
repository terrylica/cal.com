import SettingsHeader from "@calcom/web/modules/settings/components/SettingsHeader";
import { _generateMetadata, getTranslate } from "app/_utils";
import BillingView from "~/settings/billing/billing-view";
import { SeatBillingDebug } from "~/settings/billing/components/SeatBillingDebug";

export const generateMetadata = async () =>
  await _generateMetadata(
    (t) => t("billing"),
    (t) => t("manage_billing_description"),
    undefined,
    undefined,
    "/settings/billing"
  );

interface PageProps {
  params: Promise<{ id: string }>;
}

const Page = async ({ params }: PageProps) => {
  const { id } = await params;
  const teamId = parseInt(id, 10);
  const t = await getTranslate();

  return (
    <SettingsHeader
      title={t("billing")}
      description={t("manage_billing_description")}
      borderInShellHeader={false}>
      <BillingView />
      {!Number.isNaN(teamId) && <SeatBillingDebug teamId={teamId} />}
    </SettingsHeader>
  );
};

export default Page;
