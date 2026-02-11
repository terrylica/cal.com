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
        src: "/upgrade/full_roles.png",
        width: 572,
        height: 744,
      }}
      youtube="https://youtu.be/J8HsK-8W39U"
      learnMoreButton={{
        text: t("learn_more"),
        href: "https://cal.com/blog/role-based-access-control",
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
