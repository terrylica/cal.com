"use client";

import { useBookerUrl } from "@calcom/features/bookings/hooks/useBookerUrl";
import { APP_NAME, WEBAPP_URL } from "@calcom/lib/constants";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import type { RouterOutputs } from "@calcom/trpc/react";
import { Avatar, AvatarFallback, AvatarImage } from "@coss/ui/components/avatar";
import {
  Card,
  CardFrame,
  CardFrameDescription,
  CardFrameHeader,
  CardFrameTitle,
  CardPanel,
} from "@coss/ui/components/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@coss/ui/components/empty";
import { WebhookIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import React from "react";
import { CreateNewWebhookButton, WebhookListItem } from "../components";

type WebhooksByViewer = RouterOutputs["viewer"]["webhook"]["getByViewer"];

type Props = {
  data: WebhooksByViewer;
};

const WebhooksView = ({ data }: Props) => {
  return (
    <div>
      <WebhooksList webhooksByViewer={data} />
    </div>
  );
};

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

const WebhooksList = ({ webhooksByViewer }: { webhooksByViewer: WebhooksByViewer }) => {
  const { t } = useLocale();
  const router = useRouter();
  const { profiles, webhookGroups } = webhooksByViewer;
  const bookerUrl = useBookerUrl();

  const hasTeams = profiles && profiles.length > 1;
  const hasWebhooks = webhookGroups.some((group) => group.webhooks.length > 0);

  return (
    <CardFrame>
      <CardFrameHeader>
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardFrameTitle>{t("webhooks")}</CardFrameTitle>
            <CardFrameDescription>{t("add_webhook_description", { appName: APP_NAME })}</CardFrameDescription>
          </div>
          {hasWebhooks && <CreateNewWebhookButton />}
        </div>
      </CardFrameHeader>
      {hasWebhooks ? (
        <>
          {webhookGroups.map((group) => (
            <React.Fragment key={group.teamId}>
              {hasTeams && (
                <div className="flex items-center gap-2 px-6 pb-2 pt-4">
                  <Avatar className="size-5">
                    <AvatarImage
                      alt={group.profile.name || ""}
                      src={group.profile.image || `${bookerUrl}/${group.profile.name}/avatar.png`}
                    />
                    <AvatarFallback className="text-[.625rem]">
                      {getInitials(group.profile.name || "")}
                    </AvatarFallback>
                  </Avatar>
                  <span className="font-bold text-sm">{group.profile.name || ""}</span>
                </div>
              )}
              <Card>
                <CardPanel className="p-0">
                  {group.webhooks.map((webhook) => (
                    <WebhookListItem
                      key={webhook.id}
                      webhook={webhook}
                      lastItem={true}
                      permissions={{
                        canEditWebhook: group?.metadata?.canModify ?? false,
                        canDeleteWebhook: group?.metadata?.canDelete ?? false,
                      }}
                      onEditWebhook={() =>
                        router.push(`${WEBAPP_URL}/settings/developer/webhooks/${webhook.id}`)
                      }
                    />
                  ))}
                </CardPanel>
              </Card>
            </React.Fragment>
          ))}
        </>
      ) : (
        <Card>
          <CardPanel>
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <WebhookIcon />
                </EmptyMedia>
                <EmptyTitle>{t("create_your_first_webhook")}</EmptyTitle>
                <EmptyDescription>
                  {t("create_your_first_webhook_description", { appName: APP_NAME })}
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <CreateNewWebhookButton isEmptyState />
              </EmptyContent>
            </Empty>
          </CardPanel>
        </Card>
      )}
    </CardFrame>
  );
};

export default WebhooksView;
