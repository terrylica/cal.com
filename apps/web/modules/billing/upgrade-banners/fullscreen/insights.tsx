"use client";

import { useLocale } from "@calcom/lib/hooks/useLocale";
import { Icon } from "@calcom/ui/components/icon";
import { FullScreenUpgradeBanner } from "@calcom/web/modules/billing/components/FullScreenUpgradeBanner";
import { UpgradePlanDialog } from "@calcom/web/modules/billing/components/UpgradePlanDialog";
import { Button } from "@coss/ui/components/button";

export function FullscreenUpgradeBannerForInsightsPage() {
  const { t } = useLocale();

  const features = [
    t("upgrade_banner_insights_feature1"),
    t("upgrade_banner_insights_feature2"),
    t("upgrade_banner_insights_feature3"),
  ];

  return (
    <FullScreenUpgradeBanner
      name={t("upgrade_banner_insights_name")}
      title={t("upgrade_banner_insights_title")}
      subtitle={t("upgrade_banner_insights_subtitle")}
      features={features}
      target="team"
      image={{
        src: "/upgrade/insights_portrait.png",
        width: 2880,
        height: 5120,
      }}
      learnMoreButton={{
        text: t("learn_more"),
        href: "https://go.cal.com/teams",
      }}>
      <UpgradePlanDialog
        info={{
          title: t("upgrade_info_team_insights_title"),
          description: t("upgrade_info_team_insights_description"),
        }}
        target="organization">
        <Button>
          {t("try_for_free")}
          <Icon name="arrow-right" />
        </Button>
      </UpgradePlanDialog>
    </FullScreenUpgradeBanner>
  );
}
