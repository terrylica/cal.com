"use client";

import {
  Card,
  CardFrame,
  CardFrameFooter,
  CardPanel,
} from "@coss/ui/components/card";
import { Skeleton } from "@coss/ui/components/skeleton";
import { WebhookFormHeader } from "./webhook-form-header";
import { WebhookTestHeader } from "./webhook-test-header";

type WebhookFormSkeletonProps = {
  titleKey?: "add_webhook" | "edit_webhook";
};

export const WebhookFormSkeleton = ({
  titleKey = "add_webhook",
}: WebhookFormSkeletonProps = {}) => {
  return (
    <div className="flex flex-col gap-4">
      <CardFrame>
        <WebhookFormHeader titleKey={titleKey} />
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
              <div className="flex flex-col gap-2">
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
        <WebhookTestHeader actions={<Skeleton className="h-8 w-28" />} />
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
