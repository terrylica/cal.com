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
import { EllipsisIcon, PencilIcon, TrashIcon, WebhookIcon } from "lucide-react";
import { useEffect, useState } from "react";
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
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [optimisticActive, setOptimisticActive] = useState(webhook.active);

  useEffect(() => {
    setOptimisticActive(webhook.active);
  }, [webhook.active]);

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
    onError() {
      setOptimisticActive(webhook.active);
    },
  });

  return (
    <ListItem data-testid="webhook-list-item">
      <ListItemContent>
        <div className="flex items-center gap-2">
          {props.profile && (
            <>
              <Avatar className="size-5">
                <AvatarImage alt={props.profile.name || ""} src={props.profile.image} />
                <AvatarFallback className="text-[.625rem]">
                  {(props.profile.name || "")
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase()
                    .slice(0, 2)}
                </AvatarFallback>
              </Avatar>
              <span className="font-medium text-sm truncate" title={props.profile.name || ""}>
                {props.profile.name || ""}
              </span>
            </>
          )}
          {!props.permissions.canEditWebhook && <Badge variant="outline">{t("readonly")}</Badge>}
          <Badge variant="info">{getWebhookVersionLabel(webhook.version)}</Badge>
        </div>
        <ListItemHeader>
          <h2
            className="truncate text-sm font-medium"
            data-slot="list-item-title"
            data-testid="webhook-url">
            {webhook.subscriberUrl}
          </h2>
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
      </ListItemContent>
      {(props.permissions.canEditWebhook || props.permissions.canDeleteWebhook) && (
        <ListItemActions>
          <div className="flex items-center gap-4 max-md:hidden">
            <Tooltip>
              <TooltipTrigger
                render={
                  <Switch
                    checked={optimisticActive}
                    data-testid="webhook-switch"
                    disabled={!props.permissions.canEditWebhook}
                    onCheckedChange={(checked) => {
                      if (toggleWebhook.isPending) return;
                      setOptimisticActive(checked);
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
                {optimisticActive ? t("disable_webhook") : t("enable_webhook")}
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
                  checked={optimisticActive}
                  onCheckedChange={(checked) => {
                    if (toggleWebhook.isPending) return;
                    setOptimisticActive(checked);
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
