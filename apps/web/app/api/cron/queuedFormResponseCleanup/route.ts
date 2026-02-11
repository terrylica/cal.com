import { defaultResponderForAppDir } from "app/api/defaultResponderForAppDir";

import { handleQueuedFormResponseCleanup } from "@calcom/routing-forms/cron/queuedFormResponseCleanup";

export const GET = defaultResponderForAppDir(handleQueuedFormResponseCleanup);
