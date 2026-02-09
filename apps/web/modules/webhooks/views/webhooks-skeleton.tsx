"use client";

import { APP_NAME } from "@calcom/lib/constants";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import {
  Card,
  CardFrame,
  CardFrameDescription,
  CardFrameHeader,
  CardFrameTitle,
  CardPanel,
} from "@coss/ui/components/card";
import { Skeleton } from "@coss/ui/components/skeleton";

export const SkeletonLoader = () => {
  const { t } = useLocale();
  return (
    <CardFrame>
      <CardFrameHeader>
        <div>
          <CardFrameTitle>{t("webhooks")}</CardFrameTitle>
          <CardFrameDescription>{t("add_webhook_description", { appName: APP_NAME })}</CardFrameDescription>
        </div>
      </CardFrameHeader>
      <Card>
        <CardPanel className="p-0">
          <WebhookListItemSkeleton />
          <WebhookListItemSkeleton />
          <WebhookListItemSkeleton />
        </CardPanel>
      </Card>
    </CardFrame>
  );
};

function WebhookListItemSkeleton() {
  return (
    <div className="flex w-full items-center justify-between border-b p-4 last:border-b-0">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-56" />
        <Skeleton className="h-5 w-28" />
      </div>
      <Skeleton className="h-9 w-9" />
    </div>
  );
}
