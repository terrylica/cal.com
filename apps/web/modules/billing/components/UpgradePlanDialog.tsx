"use client";

import { useFlagMap } from "@calcom/features/flags/context/provider";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { Icon } from "@calcom/ui/components/icon";
import { Badge } from "@coss/ui/components/badge";
import { Button } from "@coss/ui/components/button";
import { Card, CardHeader, CardPanel } from "@coss/ui/components/card";
import {
  Dialog,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
  DialogTrigger,
} from "@coss/ui/components/dialog";
import { Toggle, ToggleGroup } from "@coss/ui/components/toggle-group";
import Link from "next/link";
import { useState } from "react";

type BillingPeriod = "annual" | "monthly";

interface PlanFeature {
  text: string;
}

interface PlanColumnProps {
  name: string;
  badge?: string;
  price: string;
  priceSubtext: string;
  description: string;
  features: PlanFeature[];
  buttonText: string;
  buttonHref: string;
  primaryButton?: boolean;
}

function PlanColumn({
  name,
  badge,
  price,
  priceSubtext,
  description,
  features,
  buttonText,
  buttonHref,
  primaryButton,
}: PlanColumnProps): JSX.Element {
  return (
    <Card className="flex-1 gap-0 rounded-xl border-subtle p-4 py-0">
      <CardHeader className="gap-0 px-0">
        <div className="flex items-center gap-2">
          <h3 className="font-medium text-sm text-emphasis">{name}</h3>
          {badge && <Badge variant="outline">{badge}</Badge>}
        </div>
        <p className="mt-2 leading-none font-semibold text-2xl text-emphasis">{price}</p>
        <p className="mt-2 leading-none font-medium text-sm text-subtle h-4">{priceSubtext}</p>
      </CardHeader>

      <CardPanel className="px-0">
        <Button
          className="mt-4"
          variant={primaryButton ? "default" : "outline"}
          render={<Link href={buttonHref} />}>
          {buttonText}
        </Button>

        <p className="mt-4 text-sm text-subtle">{description}</p>

        <ul className="mt-3 space-y-2">
          {features.map((feature) => (
            <li key={feature.text} className="flex items-start gap-2 text-sm">
              <Icon name="square-check" className="h-4 w-4 shrink-0 text-default" />
              <span className="text-default">{feature.text}</span>
            </li>
          ))}
        </ul>
      </CardPanel>
    </Card>
  );
}

export type UpgradePlanDialogProps = {
  children: React.ReactNode;
  target: "team" | "organization";
};

export function UpgradePlanDialog({ children, target }: UpgradePlanDialogProps): JSX.Element {
  const { t } = useLocale();
  const flags = useFlagMap();
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>("annual");

  const teamPrice = billingPeriod === "annual" ? "$12" : "$15";
  const orgPrice = billingPeriod === "annual" ? "$30" : "$37";

  const organizationHref = flags["onboarding-v3"]
    ? "/onboarding/organization/details?migrate=true"
    : "/settings/organizations/new";

  const teamFeatures: PlanFeature[] = [
    { text: t("round_robin_fixed_round_robin") },
    { text: t("collective_events") },
    { text: t("routing_forms") },
    { text: t("teams_workflows") },
    { text: t("insights_analyze_booking_data") },
    { text: t("remove_branding") },
  ];

  const orgFeatures: PlanFeature[] = [
    { text: t("everything_in_team") },
    { text: t("unlimited_teams") },
    { text: t("org_verified_domain") },
    { text: t("org_directory_sync") },
    { text: t("org_sso") },
    { text: t("org_admin_panel") },
  ];

  const enterpriseFeatures: PlanFeature[] = [
    { text: t("everything_in_org") },
    { text: t("enterprise_dedicated_support") },
    { text: t("enterprise_custom_sla") },
    { text: t("enterprise_custom_integrations") },
    { text: t("enterprise_compliance") },
  ];

  return (
    <Dialog>
      <DialogTrigger render={children as React.ReactElement} />
      <DialogPopup className="max-w-3xl" showCloseButton={false} bottomStickOnMobile={false}>
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>{t("upgrade_plan")}</DialogTitle>
            <ToggleGroup
              value={[billingPeriod]}
              onValueChange={(value): void => {
                if (value.length > 0) {
                  setBillingPeriod(value[0] as BillingPeriod);
                }
              }}
              className="rounded-lg bg-muted p-1"
              size="sm">
              <Toggle
                value="annual"
                className="gap-1 rounded-md data-pressed:bg-default data-pressed:shadow-sm">
                {t("annual")}
                <Badge variant="info" size="sm">
                  -20%
                </Badge>
              </Toggle>
              <Toggle
                value="monthly"
                className="ml-1 rounded-md data-pressed:bg-default data-pressed:shadow-sm">
                {t("monthly")}
              </Toggle>
            </ToggleGroup>
          </div>
        </DialogHeader>

        <DialogPanel>
          <div className="flex gap-4">
            {target === "team" && (
              <PlanColumn
                name={t("team")}
                badge={t("14_day_free_trial")}
                price={teamPrice}
                priceSubtext={t("per_month_user")}
                description={t("upgrade_plan_team_description")}
                features={teamFeatures}
                buttonText={t("upgrade")}
                buttonHref="/settings/teams/new"
                primaryButton={target === "team"}
              />
            )}

            <PlanColumn
              name={t("organization")}
              price={orgPrice}
              priceSubtext={t("per_month_user")}
              description={t("upgrade_plan_org_description")}
              features={orgFeatures}
              buttonText={t("upgrade")}
              buttonHref={organizationHref}
              primaryButton={target === "organization"}
            />

            <PlanColumn
              name={t("enterprise")}
              price={t("custom")}
              priceSubtext=""
              description={t("upgrade_plan_enterprise_description")}
              features={enterpriseFeatures}
              buttonText={t("contact_sales")}
              buttonHref="https://cal.com/sales"
            />
          </div>
        </DialogPanel>

        <DialogFooter>
          <div className="flex w-full items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm text-subtle">{t("individual")}</span>
              <span className="font-semibold text-emphasis text-sm">{t("free")}</span>
            </div>
            <Badge variant="outline">{t("current_plan")}</Badge>
          </div>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
