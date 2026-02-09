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
              <FieldSkeleton />
              <Skeleton className="h-5 w-40" />
              <FieldSkeleton className="h-10" />
              <FieldSkeleton />
              <FieldSkeleton className="h-9 w-32" />
              <Skeleton className="h-5 w-48" />
            </div>
          </CardPanel>
        </Card>
        <CardFrameFooter className="flex justify-end gap-2">
          <Skeleton className="h-9 w-20" />
          <Skeleton className="h-9 w-32" />
        </CardFrameFooter>
      </CardFrame>
      <CardFrame>
        <CardFrameHeader>
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col gap-1">
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-4 w-52" />
            </div>
            <Skeleton className="h-9 w-28" />
          </div>
        </CardFrameHeader>
        <Card>
          <CardPanel>
            <div className="flex flex-col gap-2">
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-24 w-full rounded-lg" />
            </div>
          </CardPanel>
        </Card>
      </CardFrame>
    </div>
  );
};

function FieldSkeleton({ className }: { className?: string }) {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="h-4 w-28" />
      <Skeleton className={className ?? "h-9 w-full"} />
    </div>
  );
}
