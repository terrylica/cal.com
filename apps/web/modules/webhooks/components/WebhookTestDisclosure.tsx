"use client";

import { useLocale } from "@calcom/lib/hooks/useLocale";
import { trpc } from "@calcom/trpc/react";
import { ZTestTriggerInputSchema } from "@calcom/trpc/server/routers/viewer/webhook/testTrigger.schema";
import { showToast } from "@calcom/ui/components/toast";
import { Badge } from "@coss/ui/components/badge";
import { Button } from "@coss/ui/components/button";
import {
  Card,
  CardFrame,
  CardFrameDescription,
  CardFrameHeader,
  CardFrameTitle,
  CardPanel,
} from "@coss/ui/components/card";
import { Label } from "@coss/ui/components/label";
import { ActivityIcon } from "lucide-react";
import { useWatch } from "react-hook-form";
import { ZodError } from "zod";

export default function WebhookTestDisclosure() {
  const [subscriberUrl, webhookSecret]: [string, string] = useWatch({ name: ["subscriberUrl", "secret"] });
  const payloadTemplate = useWatch({ name: "payloadTemplate" }) || null;
  const { t } = useLocale();
  const mutation = trpc.viewer.webhook.testTrigger.useMutation({
    onError(err) {
      showToast(err.message, "error");
    },
  });

  return (
    <CardFrame>
      <CardFrameHeader>
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardFrameTitle>{t("webhook_test")}</CardFrameTitle>
            <CardFrameDescription>{t("test_webhook")}</CardFrameDescription>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={mutation.isPending || !subscriberUrl}
            onClick={() => {
              try {
                ZTestTriggerInputSchema.parse({
                  url: subscriberUrl,
                  secret: webhookSecret,
                  type: "PING",
                  payloadTemplate,
                });
                mutation.mutate({ url: subscriberUrl, secret: webhookSecret, type: "PING", payloadTemplate });
              } catch (error) {
                if (error instanceof ZodError) {
                  const errorMessage = error.errors.map((e) => e.message).join(", ");
                  showToast(errorMessage, "error");
                } else {
                  showToast(t("unexpected_error_try_again"), "error");
                }
              }
            }}>
            <ActivityIcon />
            {t("ping_test")}
          </Button>
        </div>
      </CardFrameHeader>
      <Card>
        <CardPanel>
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Label render={<div />}>{t("webhook_response")}</Label>
              {mutation.data && (
                <Badge variant={mutation.data.ok ? "success" : "error"}>
                  {mutation.data.ok ? t("passed") : t("failed")}
                </Badge>
              )}
            </div>
            <div className="rounded-lg border p-4 font-mono text-sm">
              {!mutation.data && <p>{t("no_data_yet")}</p>}
              {mutation.status === "success" && mutation.data && (
                <div>
                  <span className="text-muted-foreground">{t("status")}:</span>{" "}
                  <span>{mutation.data.status}</span>
                </div>
              )}
            </div>
          </div>
        </CardPanel>
      </Card>
    </CardFrame>
  );
}
