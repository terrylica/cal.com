"use client";

import { Icon } from "@calcom/ui/components/icon";
import { UpgradePlanDialog } from "@calcom/web/modules/billing/components/UpgradePlanDialog";
import { useBanners } from "@calcom/web/modules/shell/banners/useBanners";
import { Button } from "@coss/ui/components/button";
import useMediaQuery from "@calcom/lib/hooks/useMediaQuery";
import Link from "next/link";
import { Badge } from "@coss/ui/components/badge";
import { useLocale } from "@calcom/lib/hooks/useLocale";

const SHELL_FIXED_OFFSET_MOBILE = 174;
const SHELL_FIXED_OFFSET_TABLET = 174;
const SHELL_FIXED_OFFSET_DESKTOP = 32;

export type UpgradeTarget = "team" | "organization";

export type FullScreenUpgradeBannerProps = {
  title: string;
  subtitle: string;
  features: string[];
  target: UpgradeTarget;
  learnMoreButton?: {
    text: string;
    href?: string;
    onClick?: () => void;
  };
  children: React.ReactNode;
};

function useDeviceSpecificOffset() {
  const isMobile = useMediaQuery("(max-width: 640px)");
  const isTablet = useMediaQuery("(max-width: 768px)");

  if (isMobile) {
    return 174;
  } else if (isTablet) {
    return 214;
  } else {
    return 32 + 16;
  }
}

export function FullScreenUpgradeBanner({
  title,
  subtitle,
  features,
  target,
  learnMoreButton,
  children,
}: FullScreenUpgradeBannerProps): JSX.Element {
  const { bannersHeight } = useBanners();
  const deviceSpecificOffset = useDeviceSpecificOffset();
  const { t } = useLocale();

  return (
    <div
      className="flex w-full flex-1 items-center justify-center rounded-xl bg-subtle p-8"
      style={{ minHeight: `calc(100vh - ${bannersHeight + deviceSpecificOffset}px)` }}>
      <div className="flex w-full max-w-3xl gap-2 overflow-hidden rounded-3xl bg-default py-8 pl-8 shadow-sm">
        {/* Left Content */}
        <div className="flex flex-1 flex-col">
          <h2 className="font-cal font-semibold text-emphasis text-xl leading-none">{title}</h2>
          <p className="mt-1 font-semibold text-subtle text-xl leading-none">{subtitle}</p>

          {/* Features List */}
          <ul className="mt-5 space-y-2">
            {features.map((feature) => (
              <li key={feature} className="flex items-center gap-2 text-sm text-subtle">
                <span className="text-subtle">•</span>
                {feature}
              </li>
            ))}
          </ul>


          <div className="mt-10">
            <Badge variant="outline" className="text-sm text-default font-medium bg-subtle px-2 py-1 h-fit! border-0">
              <Icon name="sparkles" />
              {target === "team" ? t("available_team_plans") : t("available_org_plans")}
            </Badge>
          </div>
          {/* Buttons */}
          <div className="mt-2 flex items-center gap-2">
            {children}
            {learnMoreButton &&
              (learnMoreButton.href ? (
                <Button
                  variant="ghost"
                  className="text-subtle"
                  render={<Link href={learnMoreButton.href} target="_blank" rel="noopener noreferrer" />}>
                  {learnMoreButton.text}
                </Button>
              ) : (
                <Button variant="ghost" className="text-subtle" onClick={learnMoreButton.onClick}>
                  {learnMoreButton.text}
                </Button>
              ))}
          </div>
        </div>

        {/* Right Content - Image Placeholder */}
        <div className="-my-2 flex flex-1 items-center justify-center rounded-l-xl bg-subtle">
          <span className="text-muted text-sm"></span>
        </div>
      </div>
    </div>
  );
}
