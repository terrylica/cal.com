import { cookies, headers } from "next/headers";

import { getServerSession } from "@calcom/features/auth/lib/getServerSession";
import { buildLegacyRequest } from "@lib/buildLegacyCtx";
import SettingsHeader from "@calcom/features/settings/appDir/SettingsHeader";
import { MembershipRole } from "@calcom/prisma/enums";

import { _generateMetadata, getTranslate } from "app/_utils";

import BillingView from "~/settings/billing/billing-view";
import { SeatBillingDebug } from "~/settings/billing/components/SeatBillingDebug";

import { validateUserHasOrgPerms } from "../../actions/validateUserHasOrgPerms";

export const generateMetadata = async () =>
  await _generateMetadata(
    (t) => t("billing"),
    (t) => t("manage_billing_description"),
    undefined,
    undefined,
    "/settings/organizations/billing"
  );

const Page = async () => {
  const t = await getTranslate();
  const session = await getServerSession({
    req: buildLegacyRequest(await headers(), await cookies()),
  });
  const orgId = session?.user?.org?.id;

  await validateUserHasOrgPerms({
    permission: "organization.manageBilling",
    fallbackRoles: [MembershipRole.OWNER, MembershipRole.ADMIN],
  });

  return (
    <SettingsHeader
      title={t("billing")}
      description={t("manage_billing_description")}
      borderInShellHeader={false}
    >
      <BillingView />
      {orgId && <SeatBillingDebug teamId={orgId} />}
    </SettingsHeader>
  );
};

export default Page;
