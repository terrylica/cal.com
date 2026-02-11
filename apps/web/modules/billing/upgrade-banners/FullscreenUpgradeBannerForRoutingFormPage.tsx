"use client";

import { useLocale } from "@calcom/lib/hooks/useLocale";
import { Icon } from "@calcom/ui/components/icon";
import { FullScreenUpgradeBanner } from "@calcom/web/modules/billing/components/FullScreenUpgradeBanner";
import { UpgradePlanDialog } from "@calcom/web/modules/billing/components/UpgradePlanDialog";
import { Button } from "@coss/ui/components/button";

export function FullscreenUpgradeBannerForRoutingFormPage() {
  const { t } = useLocale();

  return (
    <FullScreenUpgradeBanner
      name={t("upgrade_banner_routing_form_name")}
      title={t("upgrade_banner_routing_form_title")}
      subtitle={t("upgrade_banner_routing_form_subtitle")}
      target="team"
      image={{
        src: "/upgrade/full_insights_routing.png",
        width: 572,
        height: 744,
      }}
      youtubeId="omM89sE7Jpg"
      learnMoreButton={{
        text: t("learn_more"),
        href: "https://cal.com/routing",
      }}>
      <UpgradePlanDialog
        info={{
          title: t("upgrade_info_team_insights_title"),
          description: t("upgrade_info_team_insights_description"),
        }}
        target="team">
        <Button>
          {t("try_for_free")}
          <Icon name="arrow-right" />
        </Button>
      </UpgradePlanDialog>
    </FullScreenUpgradeBanner>
  );
}
