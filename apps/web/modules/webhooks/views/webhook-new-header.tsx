"use client";

import { APP_NAME } from "@calcom/lib/constants";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { Button } from "@coss/ui/components/button";
import {
  CardFrameDescription,
  CardFrameHeader,
  CardFrameTitle,
} from "@coss/ui/components/card";
import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";

export function WebhookNewHeader() {
  const { t } = useLocale();

  return (
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
  );
}
