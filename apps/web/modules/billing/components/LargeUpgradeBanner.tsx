"use client";

import { useLocale } from "@calcom/lib/hooks/useLocale";
import { Badge } from "@coss/ui/components/badge";
import { Button } from "@coss/ui/components/button";
import Image from "next/image";
import Link from "next/link";
import type { UpgradeTarget } from "./types";

export type LargeUpgradeBannerProps = {
  title: string;
  subtitle: string;
  target: UpgradeTarget;
  showBadge?: boolean;
  image?: {
    src: string;
    alt: string;
  };
  learnMoreButton?: {
    text: string;
    href?: string;
    onClick?: () => void;
  };
  children: React.ReactNode;
};

export function LargeUpgradeBanner({
  title,
  subtitle,
  target,
  showBadge,
  image,
  learnMoreButton,
  children,
}: LargeUpgradeBannerProps) {
  const { t } = useLocale();

  return (
    <div className="flex w-full overflow-hidden rounded-xl bg-muted border-muted border">
      {/* Left Content */}
      <div className="flex flex-1 flex-col p-6">
        <div className="flex items-center gap-2">
          <h2 className="font-cal text-lg font-semibold leading-none text-default">{title}</h2>
          {showBadge && <Badge variant="info">{target === "team" ? t("teams") : t("orgs")}</Badge>}
        </div>
        <p className="mt-2 text-sm text-subtle">{subtitle}</p>

        {/* Buttons */}
        <div className="mt-6 flex items-center gap-2">
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

      {/* Right Content - Optional Image */}
      {image && (
        <div className="hidden flex-1 items-center justify-center md:flex">
          <Image src={image.src} alt={image.alt} width={400} height={200} className="object-contain" />
        </div>
      )}
    </div>
  );
}
