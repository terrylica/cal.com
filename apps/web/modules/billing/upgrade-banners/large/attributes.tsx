"use client";

import { useLocale } from "@calcom/lib/hooks/useLocale";
import { Icon } from "@calcom/ui/components/icon";
import { LargeUpgradeBanner } from "@calcom/web/modules/billing/components/LargeUpgradeBanner";
import { UpgradePlanDialog } from "@calcom/web/modules/billing/components/UpgradePlanDialog";
import { Button } from "@coss/ui/components/button";

export function LargeUpgradeBannerForAttributes() {
  const { t } = useLocale();

  return (
    <LargeUpgradeBanner
      title={t("attributes")}
      subtitle="Create a team and route people to other people on your team based on their responses."
      target="organization"
      showBadge={true}>
      <UpgradePlanDialog target="organization">
        <Button variant="outline">
          {t("try_for_free")}
          <Icon name="arrow-right" />
        </Button>
      </UpgradePlanDialog>
    </LargeUpgradeBanner>
  );
}
