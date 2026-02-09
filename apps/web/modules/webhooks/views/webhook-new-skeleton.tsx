"use client";

import { APP_NAME } from "@calcom/lib/constants";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { Button } from "@coss/ui/components/button";
import {
  Card,
  CardFrame,
  CardFrameDescription,
  CardFrameFooter,
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
    <div className="flex flex-col gap-4">
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
        <Card className="rounded-b-none!">
          <CardPanel>
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-8 w-full" />
              </div>
              <div className="flex items-center gap-2">
                <Skeleton className="h-4.5 w-7.5 rounded-full" />
                <Skeleton className="h-4 w-28" />
              </div>
              <div className="flex flex-col gap-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-36 w-full" />
                <Skeleton className="h-6 w-32" />
              </div>
              <div className="flex flex-col gap-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-8 w-full" />
              </div>
              <div className="flex flex-col gap-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-8 w-full" />
              </div> 
              <div className="flex flex-col gap-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-8 w-30" />
                <Skeleton className="h-3 my-0.5 w-40" />
              </div>
              <div className="flex items-center gap-2">
                <Skeleton className="h-4.5 w-7.5 rounded-full" />
                <Skeleton className="h-4 w-28" />
              </div>              
            </div>
          </CardPanel>
        </Card>
        <CardFrameFooter className="flex items-center justify-end gap-4">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-8 w-32" />
        </CardFrameFooter>
      </CardFrame>
      <CardFrame>
        <CardFrameHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardFrameTitle>{t("webhook_test")}</CardFrameTitle>
              <CardFrameDescription>{t("test_webhook")}</CardFrameDescription>
            </div>
            <Skeleton className="h-8 w-28" />
          </div>
        </CardFrameHeader>
        <Card>
          <CardPanel>
            <div className="flex flex-col gap-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-13.5 w-full" />
            </div>
          </CardPanel>
        </Card>
      </CardFrame>
    </div>
  );
};
