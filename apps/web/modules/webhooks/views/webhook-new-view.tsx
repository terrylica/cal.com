"use client";

import {
  getWebhookVersionDocsUrl,
  getWebhookVersionLabel,
  WEBHOOK_TRIGGER_EVENTS,
  WEBHOOK_VERSION_OPTIONS,
} from "@calcom/features/webhooks/lib/constants";
import { subscriberUrlReserved } from "@calcom/features/webhooks/lib/subscriberUrlReserved";
import { useCompatSearchParams } from "@calcom/lib/hooks/useCompatSearchParams";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import type { RouterOutputs } from "@calcom/trpc/react";
import { trpc } from "@calcom/trpc/react";
import { toastManager } from "@coss/ui/components/toast";
import { revalidateWebhooksList } from "@calcom/web/app/(use-page-wrapper)/settings/(settings-layout)/developer/webhooks/(with-loader)/actions";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
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
import { useMemo } from "react";
import type { ComponentType } from "react";
import type { WebhookFormSubmitData } from "../components/WebhookForm";
import WebhookForm from "../components/WebhookForm";
import { WebhookFormHeader } from "./webhook-form-header";

const webhookVersionItems = WEBHOOK_VERSION_OPTIONS.map((option) => ({
  value: option.value,
  label: option.label,
}));

type Props = {
  webhooks: RouterOutputs["viewer"]["webhook"]["list"];
  installedApps: RouterOutputs["viewer"]["apps"]["integrations"];
};

export const NewWebhookView = ({ webhooks, installedApps }: Props) => {
  const searchParams = useCompatSearchParams();
  const { t } = useLocale();
  const versionTooltipHandle = useMemo(() => TooltipCreateHandle<ComponentType>(), []);
  const utils = trpc.useUtils();
  const router = useRouter();
  const session = useSession();

  const teamId = searchParams?.get("teamId") ? Number(searchParams.get("teamId")) : undefined;
  const platform = searchParams?.get("platform") ? Boolean(searchParams.get("platform")) : false;

  const createWebhookMutation = trpc.viewer.webhook.create.useMutation({
    async onSuccess() {
      toastManager.add({ title: t("webhook_created_successfully"), type: "success" });
      await utils.viewer.webhook.list.invalidate();
      revalidateWebhooksList();
      router.push("/settings/developer/webhooks");
    },
    onError(error) {
      toastManager.add({ title: error.message, type: "error" });
    },
  });

  const onCreateWebhook = async (values: WebhookFormSubmitData) => {
    if (
      subscriberUrlReserved({
        subscriberUrl: values.subscriberUrl,
        id: values.id,
        webhooks,
        teamId,
        userId: session.data?.user.id,
        platform,
      })
    ) {
      toastManager.add({ title: t("webhook_subscriber_url_reserved"), type: "error" });
      return;
    }

    if (!values.payloadTemplate) {
      values.payloadTemplate = null;
    }

    createWebhookMutation.mutate({
      subscriberUrl: values.subscriberUrl,
      eventTriggers: values.eventTriggers.filter((trigger) =>
        WEBHOOK_TRIGGER_EVENTS.includes(trigger as (typeof WEBHOOK_TRIGGER_EVENTS)[number])
      ) as unknown as Parameters<typeof createWebhookMutation.mutate>[0]["eventTriggers"],
      active: values.active,
      payloadTemplate: values.payloadTemplate,
      secret: values.secret,
      time: values.time,
      timeUnit: values.timeUnit,
      version: values.version,
      teamId,
      platform,
    });
  };

  return (
    <WebhookForm
      noRoutingFormTriggers={false}
      onSubmit={onCreateWebhook}
      apps={installedApps?.items.map((app) => app.slug)}
      headerWrapper={(formMethods, children) => {
        const version = formMethods.watch("version");
        const selectedVersionItem =
          webhookVersionItems.find((item) => item.value === version) ?? webhookVersionItems[0];

        return (
          <CardFrame>
            <WebhookFormHeader
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
    />
  );
};

export default NewWebhookView;
