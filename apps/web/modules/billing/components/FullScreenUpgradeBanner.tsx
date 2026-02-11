"use client";

import { useFillRemainingHeight } from "@calcom/lib/hooks/useFillRemainingHeight";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import useMediaQuery from "@calcom/lib/hooks/useMediaQuery";
import { Icon } from "@calcom/ui/components/icon";
import { UpgradePlanDialog } from "@calcom/web/modules/billing/components/UpgradePlanDialog";
import { Badge } from "@coss/ui/components/badge";
import { Button } from "@coss/ui/components/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from "@coss/ui/components/dialog";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import type { UpgradeTarget } from "./types";

export type { UpgradeTarget };

export type FullScreenUpgradeBannerProps = {
  name: string;
  title: string;
  subtitle: string;
  features?: string[];
  target: UpgradeTarget;
  learnMoreButton?: {
    text: string;
    href?: string;
    onClick?: () => void;
  };
  extraOffset?:
    | number
    | {
        mobile?: number;
        tablet?: number;
        desktop?: number;
      };
  image: {
    src: string;
    width: number;
    height: number;
  };
  youtubeId?: string;
};

function useResponsiveOffset(
  extraOffset?:
    | number
    | {
        mobile?: number;
        tablet?: number;
        desktop?: number;
      }
) {
  const isMobile = useMediaQuery("(max-width: 639px)");
  const isTablet = useMediaQuery("(max-width: 767px)");

  if (isMobile) {
    return typeof extraOffset === "number" ? extraOffset : (extraOffset?.mobile ?? 74);
  } else if (isTablet) {
    return typeof extraOffset === "number" ? extraOffset : (extraOffset?.tablet ?? 85);
  } else {
    return typeof extraOffset === "number" ? extraOffset : (extraOffset?.desktop ?? 24);
  }
}

export function FullScreenUpgradeBanner({
  name,
  title,
  subtitle,
  features,
  target,
  learnMoreButton,
  extraOffset,
  image,
  youtubeId,
}: FullScreenUpgradeBannerProps): JSX.Element {
  const [videoOpen, setVideoOpen] = useState(false);
  const deviceSpecificOffset = useResponsiveOffset(extraOffset);
  const { t } = useLocale();
  const ref = useFillRemainingHeight(deviceSpecificOffset);

  return (
    <div ref={ref} className="flex w-full shrink-0 items-center justify-center rounded-xl bg-subtle p-8">
      <div className="flex w-full max-w-3xl gap-2 overflow-hidden rounded-3xl bg-default py-8 pl-8 shadow-sm">
        {/* Left Content */}
        <div className="flex flex-1 flex-col justify-between">
          <div>
            <div>
              <Badge
                variant="outline"
                className="text-sm text-default font-medium bg-subtle px-2 py-1 h-fit! border-0">
                {name}
              </Badge>
            </div>
            <h2 className="mt-3 font-cal font-semibold text-emphasis text-xl leading-none">{title}</h2>
            <p className="mt-2 text-subtle text-sm">{subtitle}</p>

            {/* Features List */}
            {features && (
              <ul className="mt-4 space-y-2">
                {features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2 text-sm text-subtle">
                    <span className="text-subtle">•</span>
                    {feature}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-subtle">{t("available_on")}</p>
              {target === "team" && <Badge variant="warning">{t("teams")}</Badge>}
              {(target === "team" || target === "organization") && (
                <Badge variant="warning" className="bg-purple-200 text-purple-700">
                  {t("orgs")}
                </Badge>
              )}
            </div>
            <div className="mt-4 h-px w-full border border-t-subtle border-dashed" />
            {/* Buttons */}
            <div className="mt-6 flex items-center gap-2">
              <UpgradePlanDialog
                info={{
                  title,
                  description: subtitle,
                }}
                target={target}>
                <Button>
                  {t("try_for_free")}
                  <Icon name="arrow-right" />
                </Button>
              </UpgradePlanDialog>
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
        </div>

        {/* Right Content - Image */}
        <div className="-my-2 flex flex-1 items-center justify-center rounded-l-xl bg-subtle aspect-[3/4] overflow-hidden border border-muted border-r-0 relative">
          <Image
            src={image.src}
            alt={name}
            width={image.width}
            height={image.height}
            className="h-full w-full object-cover"
          />
          {youtubeId && (
            <button
              type="button"
              className="absolute inset-0 flex items-center justify-center cursor-pointer"
              onClick={() => setVideoOpen(true)}>
              <Image src="/play_button.svg" alt="Play video" width={48} height={48} />
            </button>
          )}
        </div>
      </div>

      {youtubeId && (
        <Dialog open={videoOpen} onOpenChange={setVideoOpen}>
          <DialogPopup className="max-w-3xl overflow-hidden">
            <DialogHeader>
              <DialogTitle>{name}</DialogTitle>
              <DialogDescription>
                {t("available_on_plan", { plan: target === "organization" ? "Organization" : "Team" })}
              </DialogDescription>
            </DialogHeader>
            <div className="aspect-video w-full px-6 pb-6">
              <iframe
                src={`https://www.youtube.com/embed/${youtubeId}`}
                title={title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="h-full w-full rounded-lg"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setVideoOpen(false)}>
                {t("dismiss")}
              </Button>
              <UpgradePlanDialog
                info={{
                  title,
                  description: subtitle,
                }}
                target={target}>
                <Button>
                  {t("get_started")}
                  <Icon name="arrow-right" />
                </Button>
              </UpgradePlanDialog>
            </DialogFooter>
          </DialogPopup>
        </Dialog>
      )}
    </div>
  );
}
