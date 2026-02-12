"use client";

import {
  getWebhookVersionDocsUrl,
  getWebhookVersionLabel,
  WEBHOOK_TRIGGER_EVENTS,
  WEBHOOK_VERSION_OPTIONS,
} from "@calcom/features/webhooks/lib/constants";
import type { WebhookVersion } from "@calcom/features/webhooks/lib/interface/IWebhookRepository";
import { subscriberUrlReserved } from "@calcom/features/webhooks/lib/subscriberUrlReserved";
import { APP_NAME } from "@calcom/lib/constants";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import type { WebhookTriggerEvents } from "@calcom/prisma/enums";
import { trpc } from "@calcom/trpc/react";
import { SkeletonContainer } from "@calcom/ui/components/skeleton";
import { toastManager } from "@coss/ui/components/toast";
import { revalidateWebhooksList } from "@calcom/web/app/(use-page-wrapper)/settings/(settings-layout)/developer/webhooks/(with-loader)/actions";
import { Button } from "@coss/ui/components/button";
import { CardFrame, CardFrameDescription, CardFrameHeader, CardFrameTitle } from "@coss/ui/components/card";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "@coss/ui/components/select";
import { Tooltip, TooltipPopup, TooltipTrigger } from "@coss/ui/components/tooltip";
import { ExternalLinkIcon } from "lucide-react";
import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { WebhookFormSubmitData } from "../components/WebhookForm";
import WebhookForm from "../components/WebhookForm";

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

  if (isPending || !webhook) return <SkeletonContainer />;

  const webhookVersionItems = WEBHOOK_VERSION_OPTIONS.map((option) => ({
    value: option.value,
    label: option.label,
  }));

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
            <CardFrameHeader>
              <div className="flex min-w-0 flex-col gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <Button
                    aria-label={t("go_back")}
                    render={<Link href="/settings/developer/webhooks" />}
                    size="icon-sm"
                    variant="ghost">
                    <ArrowLeftIcon />
                  </Button>
                  <div>
                    <CardFrameTitle>{t("edit_webhook")}</CardFrameTitle>
                    <CardFrameDescription>
                      {t("add_webhook_description", { appName: APP_NAME })}
                    </CardFrameDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Tooltip>
                    <TooltipTrigger
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
                            <SelectTrigger className="min-w-36 w-fit">
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
                      }>
                    </TooltipTrigger>
                    <TooltipPopup>{t("webhook_version")}</TooltipPopup>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Link
                          href={getWebhookVersionDocsUrl(version)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted-foreground hover:text-foreground flex">
                          <ExternalLinkIcon className="size-4" />
                        </Link>
                      }>
                    </TooltipTrigger>
                    <TooltipPopup>
                      {t("webhook_version_docs", {
                        version: getWebhookVersionLabel(version),
                      })}
                    </TooltipPopup>
                  </Tooltip>
                </div>
              </div>
            </CardFrameHeader>
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
