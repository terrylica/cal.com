"use client";

import { APP_NAME } from "@calcom/lib/constants";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import {
  CardFrameDescription,
  CardFrameHeader,
  CardFrameTitle,
} from "@coss/ui/components/card";
import type { ReactNode } from "react";

export function WebhooksHeader({ actions }: { actions?: ReactNode }) {
  const { t } = useLocale();

  return (
    <CardFrameHeader>
      <div className="flex items-center justify-between gap-4">
        <div>
          <CardFrameTitle>{t("webhooks")}</CardFrameTitle>
          <CardFrameDescription>
            {t("add_webhook_description", { appName: APP_NAME })}
          </CardFrameDescription>
        </div>
        {actions}
      </div>
    </CardFrameHeader>
  );
}
