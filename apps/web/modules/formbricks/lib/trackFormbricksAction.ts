import formbricks from "@formbricks/js";

import {
  NEXT_PUBLIC_FORMBRICKS_HOST_URL,
  NEXT_PUBLIC_FORMBRICKS_ENVIRONMENT_ID,
} from "@calcom/lib/public-env";

export const trackFormbricksAction = (
  eventName: string,
  hiddenFields?: Record<string | number, string | number | string[]>
) => {
  if (NEXT_PUBLIC_FORMBRICKS_HOST_URL && NEXT_PUBLIC_FORMBRICKS_ENVIRONMENT_ID) {
    formbricks.track(eventName, hiddenFields ? { hiddenFields } : undefined);
  }
};
