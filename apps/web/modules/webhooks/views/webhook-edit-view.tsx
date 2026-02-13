"use client";

import {
  getWebhookVersionDocsUrl,
  getWebhookVersionLabel,
  WEBHOOK_TRIGGER_EVENTS,
  WEBHOOK_VERSION_OPTIONS,
} from "@calcom/features/webhooks/lib/constants";
import type { WebhookVersion } from "@calcom/features/webhooks/lib/interface/IWebhookRepository";
import { subscriberUrlReserved } from "@calcom/features/webhooks/lib/subscriberUrlReserved";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import type { WebhookTriggerEvents } from "@calcom/prisma/enums";
import { trpc } from "@calcom/trpc/react";
import { toastManager } from "@coss/ui/components/toast";
import { revalidateWebhooksList } from "@calcom/web/app/(use-page-wrapper)/settings/(settings-layout)/developer/webhooks/(with-loader)/actions";
import { Button } from "@coss/ui/components/button";
import { CardFrame } from "@coss/ui/components/card";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "@coss/ui/components/select";
import {
  Tooltip,
  TooltipCreateHandle,
  TooltipPopup,
  TooltipProvider,
  TooltipTrigger,
} from "@coss/ui/components/tooltip";
import { ExternalLinkIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import type { ComponentType } from "react";
import type { WebhookFormSubmitData } from "../components/WebhookForm";
import WebhookForm from "../components/WebhookForm";
import { WebhookNewHeader } from "./webhook-new-header";
import { SkeletonLoader } from "./webhook-new-skeleton";

const webhookVersionItems = WEBHOOK_VERSION_OPTIONS.map((option) => ({
  value: option.value,
  label: option.label,
}));

type WebhookProps = {
  id: string;
  userId: number | null;
  teamId: number | null;
  subscriberUrl: string;
  payloadTemplate: string | null;
  active: boolean;
  eventTriggers: WebhookTriggerEvents[];
  secret: string | null;
  platform: boolean;
  version: WebhookVersion;
};

export function EditWebhookView({ webhook }: { webhook?: WebhookProps }) {
  const { t } = useLocale();
  const router = useRouter();
  const versionTooltipHandle = useMemo(() => TooltipCreateHandle<ComponentType>(), []);
  const { data: installedApps, isPending } = trpc.viewer.apps.integrations.useQuery(
    { variant: "other", onlyInstalled: true },
    {
      suspense: true,
      enabled: !!webhook,
    }
  );

  const { data: webhooks } = trpc.viewer.webhook.list.useQuery(undefined, {
    suspense: true,
    enabled: !!webhook,
  });
  const editWebhookMutation = trpc.viewer.webhook.edit.useMutation({
    onSuccess() {
      toastManager.add({ title: t("webhook_updated_successfully"), type: "success" });
      router.push("/settings/developer/webhooks");
      revalidateWebhooksList();
    },
    onError(error) {
      toastManager.add({ title: error.message, type: "error" });
    },
  });

  if (isPending || !webhook) return <SkeletonLoader titleKey="edit_webhook" />;

  return (
    <WebhookForm
      noRoutingFormTriggers={false}
      webhook={webhook}
      headerWrapper={(formMethods, children) => {
        const version = formMethods.watch("version");
        const selectedVersionItem =
          webhookVersionItems.find((item) => item.value === version) ?? webhookVersionItems[0];

        return (
          <CardFrame>
            <WebhookNewHeader
              titleKey="edit_webhook"
              CTA={
                <div className="flex items-center gap-1 self-center">
                  <TooltipProvider delay={0}>
                    <TooltipTrigger
                      handle={versionTooltipHandle}
                      payload={() => <>{t("webhook_version")}</>}
                      render={
                        <div className="inline-flex">
                          <Select
                            aria-label={t("webhook_version")}
                            value={selectedVersionItem}
                            onValueChange={(newValue) => {
                              if (newValue) {
                                formMethods.setValue("version", newValue.value, { shouldDirty: true });
                              }
                            }}
                            items={webhookVersionItems}>
                            <SelectTrigger size="sm" className="min-w-none">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectPopup>
                              {webhookVersionItems.map((item) => (
                                <SelectItem key={item.value} value={item}>
                                  {item.label}
                                </SelectItem>
                              ))}
                            </SelectPopup>
                          </Select>
                        </div>
                      }
                    />
                    <TooltipTrigger
                      handle={versionTooltipHandle}
                      payload={() => (
                        <>{t("webhook_version_docs", { version: getWebhookVersionLabel(version) })}</>
                      )}
                      render={
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          render={
                            <Link
                              className="text-muted-foreground hover:text-foreground flex"
                              href={getWebhookVersionDocsUrl(version)}
                              target="_blank"
                              rel="noopener noreferrer"
                            />
                          }>
                          <ExternalLinkIcon />
                        </Button>
                      }
                    />
                    <Tooltip handle={versionTooltipHandle}>
                      {({ payload: Payload }) => (
                        <TooltipPopup>{Payload !== undefined && <Payload />}</TooltipPopup>
                      )}
                    </Tooltip>
                  </TooltipProvider>
                </div>
              }
            />
            {children}
          </CardFrame>
        );
      }}
      onSubmit={(values: WebhookFormSubmitData) => {
        if (
          subscriberUrlReserved({
            subscriberUrl: values.subscriberUrl,
            id: webhook.id,
            webhooks,
            teamId: webhook.teamId ?? undefined,
            userId: webhook.userId ?? undefined,
            platform: webhook.platform ?? undefined,
          })
        ) {
          toastManager.add({ title: t("webhook_subscriber_url_reserved"), type: "error" });
          return;
        }

        if (values.changeSecret) {
          values.secret = values.newSecret.trim().length ? values.newSecret : null;
        }

        if (!values.payloadTemplate) {
          values.payloadTemplate = null;
        }

        editWebhookMutation.mutate({
          id: webhook.id,
          subscriberUrl: values.subscriberUrl,
          eventTriggers: values.eventTriggers.filter((trigger) =>
            WEBHOOK_TRIGGER_EVENTS.includes(trigger as (typeof WEBHOOK_TRIGGER_EVENTS)[number])
          ) as unknown as Parameters<typeof editWebhookMutation.mutate>[0]["eventTriggers"],
          active: values.active,
          payloadTemplate: values.payloadTemplate,
          secret: values.secret,
          time: values.time,
          timeUnit: values.timeUnit,
          version: values.version,
        });
      }}
      apps={installedApps?.items.map((app) => app.slug)}
    />
  );
}

export default EditWebhookView;
