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
} from "@coss/ui/shared/list-item";
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
        <ListItemHeader>
          <Skeleton className="h-5 sm:h-4 my-0.5 w-full max-w-[18rem] truncate" />
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
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-5 sm:h-4 w-24" />
        </div>        
      </ListItemContent>
      <ListItemActions>
        <Skeleton className="h-4.5 w-7.5 rounded-full max-md:hidden" />
        <Skeleton className="size-9 sm:size-8" />
      </ListItemActions>
    </ListItem>
  );
}
