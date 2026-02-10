"use client";

import { useLocale } from "@calcom/lib/hooks/useLocale";
import { Icon } from "@calcom/ui/components/icon";
import { FullScreenUpgradeBanner } from "@calcom/web/modules/billing/components/FullScreenUpgradeBanner";
import { UpgradePlanDialog } from "@calcom/web/modules/billing/components/UpgradePlanDialog";
import { Button } from "@coss/ui/components/button";

export function FullscreenUpgradeBannerForRolesAndPermissions() {
  const { t } = useLocale();

  return (
    <FullScreenUpgradeBanner
      name={t("upgrade_banner_roles_name")}
      title={t("upgrade_banner_roles_title")}
      subtitle={t("upgrade_banner_roles_subtitle")}
      target="organization"
      extraOffset={20}
      image={{
        src: "/upgrade/roles_portrait.png",
        width: 2160,
        height: 3840,
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
