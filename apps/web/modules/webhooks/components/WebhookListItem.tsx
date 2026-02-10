"use client";

import { getWebhookVersionLabel } from "@calcom/features/webhooks/lib/constants";
import type { Webhook } from "@calcom/features/webhooks/lib/dto/types";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { trpc } from "@calcom/trpc/react";
import { toastManager } from "@coss/ui/components/toast";
import { revalidateEventTypeEditPage } from "@calcom/web/app/(use-page-wrapper)/event-types/[type]/actions";
import { revalidateWebhooksList } from "@calcom/web/app/(use-page-wrapper)/settings/(settings-layout)/developer/webhooks/(with-loader)/actions";
import { Avatar, AvatarFallback, AvatarImage } from "@coss/ui/components/avatar";
import { Badge } from "@coss/ui/components/badge";
import { Button } from "@coss/ui/components/button";
import {
  ListItem,
  ListItemActions,
  ListItemBadges,
  ListItemTitle,
  ListItemContent,
  ListItemHeader,
} from "@coss/ui/components/list-item";
import {
  Menu,
  MenuCheckboxItem,
  MenuGroup,
  MenuItem,
  MenuPopup,
  MenuSeparator,
  MenuTrigger,
} from "@coss/ui/components/menu";
import { Switch } from "@coss/ui/components/switch";
import { Tooltip, TooltipPopup, TooltipTrigger } from "@coss/ui/components/tooltip";
import { EllipsisIcon, InfoIcon, PencilIcon, TrashIcon, WebhookIcon } from "lucide-react";
import { useRef, useState } from "react";
import { DeleteWebhookDialog } from "./dialogs/DeleteWebhookDialog";

const MAX_BADGES_TWO_ROWS = 7;

export default function WebhookListItem(props: {
  webhook: Webhook;
  profile?: { name: string | null; image?: string; slug?: string | null };
  canEditWebhook?: boolean;
  onEditWebhook: () => void;
  lastItem: boolean;
  permissions: {
    canEditWebhook?: boolean;
    canDeleteWebhook?: boolean;
  };
}) {
  const { t } = useLocale();
  const utils = trpc.useUtils();
  const { webhook } = props;
  const initialActive = useRef(webhook.active).current;
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const deleteWebhook = trpc.viewer.webhook.delete.useMutation({
    async onSuccess() {
      if (webhook.eventTypeId) revalidateEventTypeEditPage(webhook.eventTypeId);
      revalidateWebhooksList();
      toastManager.add({ title: t("webhook_removed_successfully"), type: "success" });
      await utils.viewer.webhook.getByViewer.invalidate();
      await utils.viewer.webhook.list.invalidate();
      await utils.viewer.eventTypes.get.invalidate();
      setDeleteDialogOpen(false);
    },
    onError() {
      toastManager.add({ title: t("something_went_wrong"), type: "error" });
      setDeleteDialogOpen(false);
    },
  });
  const toggleWebhook = trpc.viewer.webhook.edit.useMutation({
    async onSuccess(data) {
      if (webhook.eventTypeId) revalidateEventTypeEditPage(webhook.eventTypeId);
      revalidateWebhooksList();
      await utils.viewer.webhook.getByViewer.invalidate();
      await utils.viewer.webhook.list.invalidate();
      await utils.viewer.eventTypes.get.invalidate();
    },
  });

  return (
    <ListItem data-testid="webhook-list-item">
      <ListItemContent>
        <ListItemHeader>
          <ListItemTitle data-testid="webhook-url">
            {webhook.subscriberUrl}
          </ListItemTitle>
        </ListItemHeader>        
        <ListItemBadges>
          {webhook.eventTriggers.slice(0, MAX_BADGES_TWO_ROWS).map((trigger) => (
            <Badge key={trigger} variant="outline">
              <WebhookIcon />
              {t(`${trigger.toLowerCase()}`)}
            </Badge>
          ))}
          {webhook.eventTriggers.length > MAX_BADGES_TWO_ROWS && (
            <Badge variant="outline">
              +{webhook.eventTriggers.length - MAX_BADGES_TWO_ROWS} {t("more")}
            </Badge>
          )}
        </ListItemBadges>
        <div className="flex items-center gap-1">
          <InfoIcon className="size-3 text-muted-foreground" />
          <div className="flex items-center gap-2">
            {props.profile && (
              <>
                <span className="text-muted-foreground text-xs truncate" title={props.profile.name || ""}>
                  {props.profile.name || ""}
                </span>
              </>
            )}
            {!props.permissions.canEditWebhook && <Badge variant="warning">{t("readonly")}</Badge>}
            <Badge variant="info" size="sm">{getWebhookVersionLabel(webhook.version)}</Badge>
          </div>
        </div>                
      </ListItemContent>
      {(props.permissions.canEditWebhook || props.permissions.canDeleteWebhook) && (
        <ListItemActions>
          <div className="flex items-center gap-4 max-md:hidden">
            <Tooltip>
              <TooltipTrigger
                render={
                  <Switch
                    defaultChecked={initialActive}
                    data-testid="webhook-switch"
                    disabled={!props.permissions.canEditWebhook}
                    onCheckedChange={(checked, eventDetails) => {
                      if (toggleWebhook.isPending) {
                        eventDetails.cancel();
                        return;
                      }
                      toggleWebhook.mutate({
                        id: webhook.id,
                        active: checked,
                        payloadTemplate: webhook.payloadTemplate,
                        eventTypeId: webhook.eventTypeId || undefined,
                      });
                    }}
                  />
                }
              />
              <TooltipPopup sideOffset={11}>
                {webhook.active ? t("disable_webhook") : t("enable_webhook")}
              </TooltipPopup>
            </Tooltip>

            <Menu>
              <MenuTrigger
                render={
                  <Button
                    aria-label={t("options")}
                    size="icon"
                    variant="outline"
                    data-testid="webhook-options">
                    <EllipsisIcon />
                  </Button>
                }
              />
              <MenuPopup align="end">
                {props.permissions.canEditWebhook && (
                  <MenuItem onClick={props.onEditWebhook} data-testid="webhook-edit-button">
                    <PencilIcon />
                    {t("edit")}
                  </MenuItem>
                )}
                {props.permissions.canDeleteWebhook && (
                  <MenuItem
                    variant="destructive"
                    onClick={() => setDeleteDialogOpen(true)}
                    disabled={deleteWebhook.isPending}
                    data-testid="delete-webhook">
                    <TrashIcon />
                    {t("delete")}
                  </MenuItem>
                )}
              </MenuPopup>
            </Menu>
          </div>

          <Menu>
            <MenuTrigger
              className="md:hidden"
              render={
                <Button aria-label={t("options")} size="icon" variant="outline">
                  <EllipsisIcon />
                </Button>
              }
            />
            <MenuPopup align="end">
              {props.permissions.canEditWebhook && (
                <MenuItem onClick={props.onEditWebhook}>
                  <PencilIcon />
                  {t("edit")}
                </MenuItem>
              )}
              <MenuSeparator />
              <MenuGroup>
                <MenuCheckboxItem
                  defaultChecked={initialActive}
                  onCheckedChange={(checked, eventDetails) => {
                    if (toggleWebhook.isPending) {
                      eventDetails.cancel();
                      return;
                    }
                    toggleWebhook.mutate({
                      id: webhook.id,
                      active: checked,
                      payloadTemplate: webhook.payloadTemplate,
                      eventTypeId: webhook.eventTypeId || undefined,
                    });
                  }}
                  variant="switch">
                  {t("enable_webhook")}
                </MenuCheckboxItem>
              </MenuGroup>
              <MenuSeparator />
              {props.permissions.canDeleteWebhook && (
                <MenuItem
                  variant="destructive"
                  onClick={() => setDeleteDialogOpen(true)}
                  disabled={deleteWebhook.isPending}>
                  <TrashIcon />
                  {t("delete")}
                </MenuItem>
              )}
            </MenuPopup>
          </Menu>
        </ListItemActions>
      )}
      <DeleteWebhookDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        isPending={deleteWebhook.isPending}
        onConfirm={() => {
          deleteWebhook.mutate({
            id: webhook.id,
            eventTypeId: webhook.eventTypeId || undefined,
            teamId: webhook.teamId || undefined,
          });
        }}
      />
    </ListItem>
  );
}
