"use client";

import { useLocale } from "@calcom/lib/hooks/useLocale";
import { FullScreenUpgradeBanner } from "@calcom/web/modules/billing/components/FullScreenUpgradeBanner";

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
      upgradeButton={{
        text: t("try_free_for_14_days"),
        target: "team",
      }}
      learnMoreButton={{
        text: t("learn_more"),
        href: "https://go.cal.com/teams",
      }}
    />
  );
}
