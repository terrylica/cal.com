"use client";

import { useLocale } from "@calcom/lib/hooks/useLocale";
import { Icon } from "@calcom/ui/components/icon";
import { FullScreenUpgradeBanner } from "@calcom/web/modules/billing/components/FullScreenUpgradeBanner";
import { UpgradePlanDialog } from "@calcom/web/modules/billing/components/UpgradePlanDialog";
import { Button } from "@coss/ui/components/button";

export function UpgradeBannerForInsightsPage() {
  const { t } = useLocale();

  const teamsFeatures = [
    t("upgrade_feature_round_robin"),
    t("upgrade_feature_collective_events"),
    t("routing_forms"),
    t("upgrade_feature_workflows"),
    t("upgrade_feature_insights"),
    t("upgrade_feature_remove_branding"),
  ];

  return (
    <FullScreenUpgradeBanner
      title={t("insights")}
      subtitle={t("upgrade_banner_teams_subtitle")}
      features={teamsFeatures}
      target="team"
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

export function UpgradeBannerForInstantBooking() {
  const { t } = useLocale();

  const teamsFeatures = [
    t("upgrade_feature_round_robin"),
    t("upgrade_feature_collective_events"),
    t("routing_forms"),
    t("upgrade_feature_workflows"),
    t("upgrade_feature_insights"),
    t("upgrade_feature_remove_branding"),
  ];

  return (
    <FullScreenUpgradeBanner
      title={t("instant_tab_title")}
      subtitle={t("upgrade_banner_teams_subtitle")}
      features={teamsFeatures}
      target="team"
      extraOffset={20}
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

export function UpgradeBannerForRolesAndPermissions() {
  const { t } = useLocale();

  const teamsFeatures = [
    t("upgrade_feature_round_robin"),
    t("upgrade_feature_collective_events"),
    t("routing_forms"),
    t("upgrade_feature_workflows"),
    t("upgrade_feature_insights"),
    t("upgrade_feature_remove_branding"),
  ];

  return (
    <FullScreenUpgradeBanner
      title={t("roles_and_permissions")}
      subtitle={t("upgrade_banner_teams_subtitle")}
      features={teamsFeatures}
      target="team"
      extraOffset={20}
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

export function UpgradeBannerForAttributes() {
  const { t } = useLocale();

  const teamsFeatures = [
    t("upgrade_feature_round_robin"),
    t("upgrade_feature_collective_events"),
    t("routing_forms"),
    t("upgrade_feature_workflows"),
    t("upgrade_feature_insights"),
    t("upgrade_feature_remove_branding"),
  ];

  return (
    <FullScreenUpgradeBanner
      title={t("attributes")}
      subtitle={t("upgrade_banner_teams_subtitle")}
      features={teamsFeatures}
      target="team"
      extraOffset={20}
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
