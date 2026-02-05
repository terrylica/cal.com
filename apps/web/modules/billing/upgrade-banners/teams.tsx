"use client";

import { useLocale } from "@calcom/lib/hooks/useLocale";
import { FullScreenUpgradeBanner } from "@calcom/web/modules/billing/components/FullScreenUpgradeBanner";
import { UpgradePlanDialog } from "@calcom/web/modules/billing/components/UpgradePlanDialog";
import { Button } from "@coss/ui/components/button";
import { Icon } from "@calcom/ui/components/icon";

export function TeamsFullScreenUpgradeBanner() {
  const { t } = useLocale();

  const teamsFeatures = [
    t("round_robin_fixed_round_robin"),
    t("collective_events"),
    t("routing_forms"),
    t("teams_workflows"),
    t("insights_analyze_booking_data"),
    t("remove_branding"),
  ];

  return (
    <FullScreenUpgradeBanner
      title={t("teams")}
      subtitle={t("teams_upgrade_banner_subtitle")}
      features={teamsFeatures}
      target="team"
      learnMoreButton={{
        text: t("learn_more"),
        href: "https://go.cal.com/teams",
      }}
    >
      <UpgradePlanDialog
        info={{
          title: t("upgrade_team_insights_title"),
          description: t("upgrade_team_insights_description"),
        }}
        target="organization"
      >
        <Button>
          {t("try_for_free")}
          <Icon name="arrow-right" />
        </Button>
      </UpgradePlanDialog>
    </FullScreenUpgradeBanner>
  );
}
