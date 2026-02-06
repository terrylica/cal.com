"use client";

import { getWebhookVersionDocsUrl, getWebhookVersionLabel } from "@calcom/features/webhooks/lib/constants";
import type { Webhook } from "@calcom/features/webhooks/lib/dto/types";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { trpc } from "@calcom/trpc/react";
import { showToast } from "@calcom/ui/components/toast";
import { revalidateEventTypeEditPage } from "@calcom/web/app/(use-page-wrapper)/event-types/[type]/actions";
import { revalidateWebhooksList } from "@calcom/web/app/(use-page-wrapper)/settings/(settings-layout)/developer/webhooks/(with-loader)/actions";
import { Badge } from "@coss/ui/components/badge";
import { Button } from "@coss/ui/components/button";
import {
  ListItem,
  ListItemActions,
  ListItemBadges,
  ListItemContent,
  ListItemHeader,
  ListItemTitle,
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
import { EllipsisIcon, ExternalLinkIcon, PencilIcon, TrashIcon, WebhookIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { DeleteWebhookDialog } from "./dialogs/DeleteWebhookDialog";

const MAX_BADGES_TWO_ROWS = 8;

export default function WebhookListItem(props: {
  webhook: Webhook;
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

  const deleteWebhook = trpc.viewer.webhook.delete.useMutation({
    async onSuccess() {
      if (webhook.eventTypeId) revalidateEventTypeEditPage(webhook.eventTypeId);
      revalidateWebhooksList();
      showToast(t("webhook_removed_successfully"), "success");
      await utils.viewer.webhook.getByViewer.invalidate();
      await utils.viewer.webhook.list.invalidate();
      await utils.viewer.eventTypes.get.invalidate();
      setDeleteDialogOpen(false);
    },
    onError() {
      showToast(t("something_went_wrong"), "error");
      setDeleteDialogOpen(false);
    },
  });
  const toggleWebhook = trpc.viewer.webhook.edit.useMutation({
    async onSuccess(data) {
      if (webhook.eventTypeId) revalidateEventTypeEditPage(webhook.eventTypeId);
      revalidateWebhooksList();
      showToast(t(data?.active ? "enabled" : "disabled"), "success");
      await utils.viewer.webhook.getByViewer.invalidate();
      await utils.viewer.webhook.list.invalidate();
      await utils.viewer.eventTypes.get.invalidate();
    },
  });

  return (
    <ListItem
      data-testid="webhook-list-item"
      className="not-last:border-b bg-clip-padding transition-[background-color] has-[[data-slot=list-item-title]:hover]:z-1 has-[[data-slot=list-item-title]:hover]:bg-[color-mix(in_srgb,var(--color-card),var(--color-black)_2%)] dark:has-[[data-slot=list-item-title]:hover]:bg-[color-mix(in_srgb,var(--color-card),var(--color-white)_2%)]">
      <ListItemContent>
        <div className="flex items-center gap-2">
          {!props.permissions.canEditWebhook && <Badge variant="outline">{t("readonly")}</Badge>}
          <Badge variant="info">{getWebhookVersionLabel(webhook.version)}</Badge>
          <Tooltip>
            <TooltipTrigger
              render={
                <Link
                  href={getWebhookVersionDocsUrl(webhook.version)}
                  target="_blank"
                  className="text-muted-foreground hover:text-foreground">
                  <ExternalLinkIcon className="size-3.5" />
                </Link>
              }
            />
            <TooltipPopup>
              {t("webhook_version_docs", { version: getWebhookVersionLabel(webhook.version) })}
            </TooltipPopup>
          </Tooltip>
        </div>
        <ListItemHeader>
          <h2
            className="truncate font-semibold sm:text-sm"
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
                    checked={webhook.active}
                    data-testid="webhook-switch"
                    disabled={!props.permissions.canEditWebhook}
                    onCheckedChange={(checked) =>
                      toggleWebhook.mutate({
                        id: webhook.id,
                        active: checked,
                        payloadTemplate: webhook.payloadTemplate,
                        eventTypeId: webhook.eventTypeId || undefined,
                      })
                    }
                  />
                }
              />
              <TooltipPopup sideOffset={11}>
                {webhook.active ? t("disable_webhook") : t("enable_webhook")}
              </TooltipPopup>
            </Tooltip>

            <Menu>
              <Tooltip>
                <MenuTrigger
                  render={
                    <TooltipTrigger
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
                  }
                />
                <TooltipPopup>{t("options")}</TooltipPopup>
              </Tooltip>
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
                  checked={webhook.active}
                  onCheckedChange={(checked) =>
                    toggleWebhook.mutate({
                      id: webhook.id,
                      active: checked,
                      payloadTemplate: webhook.payloadTemplate,
                      eventTypeId: webhook.eventTypeId || undefined,
                    })
                  }
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
