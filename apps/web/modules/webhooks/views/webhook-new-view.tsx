"use client";

import { WEBHOOK_TRIGGER_EVENTS } from "@calcom/features/webhooks/lib/constants";
import { subscriberUrlReserved } from "@calcom/features/webhooks/lib/subscriberUrlReserved";
import { APP_NAME } from "@calcom/lib/constants";
import { useCompatSearchParams } from "@calcom/lib/hooks/useCompatSearchParams";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import type { RouterOutputs } from "@calcom/trpc/react";
import { trpc } from "@calcom/trpc/react";
import { showToast } from "@calcom/ui/components/toast";
import { revalidateWebhooksList } from "@calcom/web/app/(use-page-wrapper)/settings/(settings-layout)/developer/webhooks/(with-loader)/actions";
import { Button } from "@coss/ui/components/button";
import { CardFrame, CardFrameDescription, CardFrameHeader, CardFrameTitle } from "@coss/ui/components/card";
import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import type { WebhookFormSubmitData } from "../components/WebhookForm";
import WebhookForm from "../components/WebhookForm";

type Props = {
  webhooks: RouterOutputs["viewer"]["webhook"]["list"];
  installedApps: RouterOutputs["viewer"]["apps"]["integrations"];
};

export const NewWebhookView = ({ webhooks, installedApps }: Props) => {
  const searchParams = useCompatSearchParams();
  const { t } = useLocale();
  const utils = trpc.useUtils();
  const router = useRouter();
  const session = useSession();

  const teamId = searchParams?.get("teamId") ? Number(searchParams.get("teamId")) : undefined;
  const platform = searchParams?.get("platform") ? Boolean(searchParams.get("platform")) : false;

  const createWebhookMutation = trpc.viewer.webhook.create.useMutation({
    async onSuccess() {
      showToast(t("webhook_created_successfully"), "success");
      await utils.viewer.webhook.list.invalidate();
      revalidateWebhooksList();
      router.push("/settings/developer/webhooks");
    },
    onError(error) {
      showToast(`${error.message}`, "error");
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
      showToast(t("webhook_subscriber_url_reserved"), "error");
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
      headerWrapper={(_formMethods, children) => (
        <CardFrame>
          <CardFrameHeader>
            <div className="flex min-w-0 items-start gap-3">
              <Button
                aria-label={t("go_back")}
                render={<Link href="/settings/developer/webhooks" />}
                size="icon-sm"
                variant="ghost">
                <ArrowLeftIcon />
              </Button>
              <div>
                <CardFrameTitle>{t("add_webhook")}</CardFrameTitle>
                <CardFrameDescription>
                  {t("add_webhook_description", { appName: APP_NAME })}
                </CardFrameDescription>
              </div>
            </div>
          </CardFrameHeader>
          {children}
        </CardFrame>
      )}
    />
  );
};

export default NewWebhookView;
