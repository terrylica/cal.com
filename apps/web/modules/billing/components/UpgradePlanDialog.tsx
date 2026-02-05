"use client";

import { BILLING_PLANS, BILLING_PRICING } from "@calcom/features/ee/billing/constants";
import { useFlagMap } from "@calcom/features/flags/context/provider";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@coss/ui/components/alert";
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
      <CardPanel className="px-0">
        <div className="flex items-center gap-2">
          <h3 className="font-medium text-sm text-emphasis">{name}</h3>
          {badge && <Badge variant="outline">{badge}</Badge>}
        </div>
        <p className="mt-2 leading-none font-semibold text-2xl text-emphasis">{price}</p>
        <p className="mt-2 leading-none font-medium text-sm text-subtle h-4">{priceSubtext}</p>

        <Button
          className="mt-4 w-full"
          variant={primaryButton ? "default" : "outline"}
          render={<Link href={buttonHref} />}>
          <Icon name="circle-arrow-up" />
          <span>{buttonText}</span>
        </Button>

        <p className="mt-4 text-sm text-subtle">{description}</p>

        <ul className="mt-3 space-y-2">
          {features.map((feature) => (
            <li key={feature.text} className="flex items-start gap-2 text-sm">
              <Icon name="dot" className="relative top-0.5 h-4 w-4 shrink-0 text-default" />
              <span className="text-default">{feature.text}</span>
            </li>
          ))}
        </ul>
      </CardPanel>
    </Card>
  );
}

export type UpgradePlanDialogProps = {
  target: "team" | "organization";
  info?: {
    title: string;
    description: string;
  }
  children: React.ReactNode;
};

export function UpgradePlanDialog({ target, info, children }: UpgradePlanDialogProps): JSX.Element {
  const { t } = useLocale();
  const flags = useFlagMap();
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>("annual");

  const teamPrice = `$${BILLING_PRICING[BILLING_PLANS.TEAMS][billingPeriod]}`;
  const orgPrice = `$${BILLING_PRICING[BILLING_PLANS.ORGANIZATIONS][billingPeriod]}`;

  const teamHref = "/settings/teams/new";

  const organizationHref = flags["onboarding-v3"]
    ? "/onboarding/organization/details?migrate=true"
    : "/settings/organizations/new";

  const teamFeatures: PlanFeature[] = [
    { text: t("upgrade_feature_round_robin") },
    { text: t("upgrade_feature_collective_events") },
    { text: t("routing_forms") },
    { text: t("upgrade_feature_workflows") },
    { text: t("upgrade_feature_insights") },
    { text: t("upgrade_feature_remove_branding") },
  ];

  const orgFeatures: PlanFeature[] = [
    { text: t("upgrade_feature_everything_in_team") },
    { text: t("unlimited_teams") },
    { text: t("upgrade_feature_verified_domain") },
    { text: t("upgrade_feature_directory_sync") },
    { text: t("upgrade_feature_sso") },
    { text: t("upgrade_feature_admin_panel") },
  ];

  const enterpriseFeatures: PlanFeature[] = [
    { text: t("upgrade_feature_everything_in_org") },
    { text: t("upgrade_feature_dedicated_support") },
    { text: t("upgrade_feature_custom_sla") },
    { text: t("upgrade_feature_custom_integrations") },
    { text: t("upgrade_feature_compliance") },
  ];

  return (
    <Dialog>
      <DialogTrigger render={children as React.ReactElement} />
      <DialogPopup className="max-w-3xl" showCloseButton={false} bottomStickOnMobile={false}>
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>{t("upgrade_dialog_title")}</DialogTitle>
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
                {t("upgrade_billing_annual")}
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
          {info && (
            <Alert variant="info">
              <AlertTitle>{info.title}</AlertTitle>
              <AlertDescription>{info.description}</AlertDescription>
            </Alert>
          )}
        </DialogHeader>

        <DialogPanel>
          <div className="mt-3 flex gap-4">
            {target === "team" && (
              <PlanColumn
                name={t("team")}
                badge={t("upgrade_badge_free_trial")}
                price={teamPrice}
                priceSubtext={t("upgrade_price_per_month_user")}
                description={t("upgrade_plan_team_tagline")}
                features={teamFeatures}
                buttonText={t("upgrade_cta_teams")}
                buttonHref={teamHref}
                primaryButton={target === "team"}
              />
            )}

            <PlanColumn
              name={t("organization")}
              price={orgPrice}
              priceSubtext={t("upgrade_price_per_month_user")}
              description={t("upgrade_plan_org_tagline")}
              features={orgFeatures}
              buttonText={t("upgrade_cta_orgs")}
              buttonHref={organizationHref}
              primaryButton={target === "organization"}
            />

            <PlanColumn
              name={t("enterprise")}
              price={t("custom")}
              priceSubtext=""
              description={t("upgrade_plan_enterprise_tagline")}
              features={enterpriseFeatures}
              buttonText={t("upgrade_cta_enterprise")}
              buttonHref="https://cal.com/sales"
            />
          </div>

          <Card className="mt-2 p-4 flex-row justify-between items-center">
            {target === "team" && (
              <div>
                <p className="font-medium text-sm text-black">{t("individual")}</p>
                <p className="font-semibold text-black text-2xl">{t("free")}</p>
              </div>
            )}
            {target === "organization" && (
              <div>
                <p className="font-semibold text-black text-2xl">{t("team")}</p>
              </div>
            )}
            <Badge variant="outline" size="lg" className="opacity-50">{t("upgrade_badge_current_plan")}</Badge>
          </Card>
        </DialogPanel>
      </DialogPopup>
    </Dialog>
  );
}
