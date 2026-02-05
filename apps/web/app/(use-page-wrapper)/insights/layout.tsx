import { getServerSession } from "@calcom/features/auth/lib/getServerSession";
import { CTA_CONTAINER_CLASS_NAME } from "@calcom/features/data-table/lib/utils";
import { FeaturesRepository } from "@calcom/features/flags/features.repository";
import { PrismaOrgMembershipRepository } from "@calcom/features/membership/repositories/PrismaOrgMembershipRepository";
import { UpgradeBannerForInsightsPage } from "@calcom/web/modules/billing/upgrade-banners/fullscreen/forOrgPlan";
import { buildLegacyRequest } from "@lib/buildLegacyCtx";
import { getTranslate } from "app/_utils";
import { ShellMainAppDir } from "app/(use-page-wrapper)/(main-nav)/ShellMainAppDir";
import { cookies, headers } from "next/headers";
import Shell from "~/shell/Shell";

export default async function InsightsLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslate();
  const session = await getServerSession({ req: buildLegacyRequest(await headers(), await cookies()) });
  const userId = session?.user?.id;
  const hasOrgMembership = userId
    ? await PrismaOrgMembershipRepository.hasAnyAcceptedMembershipByUserId({ userId })
    : false;

  if (!hasOrgMembership) {
    return (
      <Shell withoutMain={true}>
        <ShellMainAppDir>
          <UpgradeBannerForInsightsPage />
        </ShellMainAppDir>
      </Shell>
    );
  }

  return (
    <Shell withoutMain={true}>
      <ShellMainAppDir
        heading={t("insights")}
        subtitle={t("insights_subtitle")}
        actions={<div className={`flex items-center gap-2 ${CTA_CONTAINER_CLASS_NAME}`} />}>
        {children}
      </ShellMainAppDir>
    </Shell>
  );
}
