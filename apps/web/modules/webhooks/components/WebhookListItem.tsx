"use client";

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
} from "@coss/ui/shared/list-item";
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
import { Tooltip, TooltipPopup, TooltipProvider, TooltipTrigger } from "@coss/ui/components/tooltip";
import { EllipsisIcon, ExternalLinkIcon, PencilIcon, TrashIcon, WebhookIcon } from "lucide-react";
import { useRef, useState } from "react";
import { DeleteWebhookDialog } from "./dialogs/DeleteWebhookDialog";
import { getWebhookVersionLabel } from "@calcom/features/webhooks/lib/constants";

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
  const [badgesExpanded, setBadgesExpanded] = useState(false);

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
          {webhook.eventTriggers
            .slice(0, badgesExpanded ? undefined : MAX_BADGES_TWO_ROWS)
            .map((trigger) => (
              <Badge key={trigger} variant="outline">
                <WebhookIcon />
                {t(`${trigger.toLowerCase()}`)}
              </Badge>
            ))}
          {!badgesExpanded && webhook.eventTriggers.length > MAX_BADGES_TWO_ROWS && (
            <Badge
              variant="outline"
              render={<button type="button" />}
              onClick={() => setBadgesExpanded(true)}
            >
              +{webhook.eventTriggers.length - MAX_BADGES_TWO_ROWS} {t("more")}
            </Badge>
          )}
        </ListItemBadges>
        <div className="flex items-center gap-1">
          <div className="flex items-center gap-2">
            {props.profile && (
              <div className="flex items-center gap-1.5 min-w-0">
                <Avatar className="size-4 shrink-0">
                  <AvatarImage src={props.profile.image} alt={props.profile.name ?? ""} />
                  <AvatarFallback className="text-[0.625rem]">
                    {(props.profile.name || props.profile.slug || "?")
                      .trim()
                      .slice(0, 1)
                      .toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="text-muted-foreground font-medium text-xs truncate" title={props.profile.name || ""}>
                  {props.profile.name || ""}
                </span>
              </div>
            )}
            {!props.permissions.canEditWebhook && <Badge variant="warning">{t("readonly")}</Badge>}
            <div className="flex items-center">
              <TooltipProvider delay={0}>
                <Tooltip>
                  <TooltipTrigger render={<Badge variant="info" />}>
                    {getWebhookVersionLabel(webhook.version)}
                  </TooltipTrigger>
                  <TooltipPopup>
                    {t("webhook_version")}
                  </TooltipPopup>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger render={<a className="h-5 sm:h-4.5 px-2 flex items-center justify-center" href={`https://cal.com/docs/developing/guides/automation/webhooks#${webhook.version}`} target="_blank" rel="noopener noreferrer" />}>
                    <span className="sr-only">{t("webhook_version_docs")}</span>
                    <ExternalLinkIcon className="size-3.5 sm:size-3 shrink-0" aria-hidden="true" />
                  </TooltipTrigger>
                  <TooltipPopup>
                    {t("webhook_version_docs", { version: getWebhookVersionLabel(webhook.version) })}
                  </TooltipPopup>
                </Tooltip>            
              </TooltipProvider>
            </div>
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
