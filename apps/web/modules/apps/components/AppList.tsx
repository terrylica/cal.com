"use client";

import { AppList as FeaturesAppList, type HandleDisconnect } from "@calcom/features/apps/components/AppList";
import type { UpdateUsersDefaultConferencingAppParams } from "@calcom/features/apps/components/AppSetDefaultLinkDialog";
import type {
  BulkUpdatParams,
  EventTypes,
} from "@calcom/features/eventtypes/components/BulkEditDefaultForEventsModal";
import type { AppCategories } from "@calcom/prisma/enums";
import type { RouterOutputs } from "@calcom/trpc/react";

import AppListCard from "./AppListCard";

export type { HandleDisconnect };

interface AppListProps {
  variant?: AppCategories;
  data: RouterOutputs["viewer"]["apps"]["integrations"];
  handleDisconnect: HandleDisconnect;
  listClassName?: string;
  appCardClassName?: string;
  appCardMenuClassName?: string;
  defaultConferencingApp: RouterOutputs["viewer"]["apps"]["getUsersDefaultConferencingApp"];
  handleUpdateUserDefaultConferencingApp: (params: UpdateUsersDefaultConferencingAppParams) => void;
  handleBulkUpdateDefaultLocation: (params: BulkUpdatParams) => void;
  isBulkUpdateDefaultLocationPending: boolean;
  eventTypes?: EventTypes;
  isEventTypesFetching?: boolean;
  handleConnectDisconnectIntegrationMenuToggle: () => void;
  handleBulkEditDialogToggle: () => void;
}

export const AppList = (props: AppListProps) => {
  return <FeaturesAppList {...props} AppListCardComponent={AppListCard} />;
};
