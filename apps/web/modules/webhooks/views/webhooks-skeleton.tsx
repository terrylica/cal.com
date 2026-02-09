"use client";

import {
  Card,
  CardFrame,
  CardPanel,
} from "@coss/ui/components/card";
import {
  ListItem,
  ListItemActions,
  ListItemBadges,
  ListItemContent,
  ListItemHeader,
} from "@coss/ui/components/list-item";
import { Skeleton } from "@coss/ui/components/skeleton";
import { WebhooksHeader } from "./webhooks-header";

export const SkeletonLoader = () => {
  return (
    <CardFrame>
      <WebhooksHeader />
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
    <ListItem>
      <ListItemContent>
        <div className="flex items-center gap-2">
          <Skeleton className="size-5 shrink-0 rounded-full" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-5.5 sm:h-4.5 w-24" />
        </div>
        <ListItemHeader>
          <Skeleton className="h-4 my-0.5 w-full max-w-[18rem] truncate rounded" />
        </ListItemHeader>
        <ListItemBadges>
          <Skeleton className="h-5.5 sm:h-4.5 w-36" />
          <Skeleton className="h-5.5 sm:h-4.5 w-36" />
          <Skeleton className="h-5.5 sm:h-4.5 w-36" />
          <Skeleton className="h-5.5 sm:h-4.5 w-36" />
          <Skeleton className="h-5.5 sm:h-4.5 w-36" />
          <Skeleton className="h-5.5 sm:h-4.5 w-36" />
          <Skeleton className="h-5.5 sm:h-4.5 w-36" />
        </ListItemBadges>
      </ListItemContent>
      <ListItemActions>
        <Skeleton className="h-4.5 w-7.5 rounded-full max-md:hidden" />
        <Skeleton className="size-9 sm:size-8" />
      </ListItemActions>
    </ListItem>
  );
}
