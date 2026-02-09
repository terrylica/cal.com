"use client";

import { APP_NAME } from "@calcom/lib/constants";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { Button } from "@coss/ui/components/button";
import {
  Card,
  CardFrame,
  CardFrameDescription,
  CardFrameHeader,
  CardFrameTitle,
  CardPanel,
} from "@coss/ui/components/card";
import { Skeleton } from "@coss/ui/components/skeleton";
import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";

export const SkeletonLoader = () => {
  const { t } = useLocale();

  return (
    <CardFrame>
      <CardFrameHeader>
        <div className="flex min-w-0 items-start gap-3">
          <Button
            aria-label={t("go_back")}
            render={<Link href="/settings/developer/webhooks" />}
            size="icon-sm"
            variant="ghost">
            <ArrowLeftIcon />
          </Button>
          <div>
            <CardFrameTitle>{t("add_webhook")}</CardFrameTitle>
            <CardFrameDescription>{t("add_webhook_description", { appName: APP_NAME })}</CardFrameDescription>
          </div>
        </div>
      </CardFrameHeader>
      <Card>
        <CardPanel>
          <div className="space-y-6">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        </CardPanel>
      </Card>
    </CardFrame>
  );
};
