"use client";

import { APP_NAME, WEBAPP_URL } from "@calcom/lib/constants";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import type { RouterOutputs } from "@calcom/trpc/react";
import { Card, CardFrame, CardPanel } from "@coss/ui/components/card";
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
import { useState } from "react";
import { CreateNewWebhookButton, WebhookListItem } from "../components";
import { WebhooksFilter } from "../components/WebhooksFilter";
import { WebhooksHeader } from "./webhooks-header";

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

const WebhooksList = ({ webhooksByViewer }: { webhooksByViewer: WebhooksByViewer }) => {
  const { t } = useLocale();
  const router = useRouter();
  const { webhookGroups } = webhooksByViewer;
  const [selectedProfileIds, setSelectedProfileIds] = useState<string[]>([]);

  const flat = webhookGroups
    .flatMap((group) => group.webhooks.map((webhook) => ({ webhook, group })))
    .sort((a, b) => a.webhook.id.localeCompare(b.webhook.id));
  const filtered =
    selectedProfileIds.length > 0
      ? flat.filter(({ group }) => selectedProfileIds.includes(group.profile.slug ?? ""))
      : flat;
  const hasWebhooks = flat.length > 0;

  return (
    <CardFrame>
      <WebhooksHeader
        actions={
          hasWebhooks ? (
            <div className="flex items-center gap-2">
              <WebhooksFilter
                groups={webhookGroups}
                selectedProfileIds={selectedProfileIds}
                onSelectionChange={setSelectedProfileIds}
              />
              <CreateNewWebhookButton />
            </div>
          ) : undefined
        }
      />
      {hasWebhooks ? (
        <Card>
          <CardPanel className="p-0">
            {filtered.map(({ webhook, group }) => (
              <WebhookListItem
                key={webhook.id}
                webhook={webhook}
                profile={group.profile}
                lastItem={true}
                permissions={{
                  canEditWebhook: group?.metadata?.canModify ?? false,
                  canDeleteWebhook: group?.metadata?.canDelete ?? false,
                }}
                onEditWebhook={() => router.push(`${WEBAPP_URL}/settings/developer/webhooks/${webhook.id}`)}
              />
            ))}
          </CardPanel>
        </Card>
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
