import formbricks from "@formbricks/js/app";

import {
  NEXT_PUBLIC_FORMBRICKS_HOST_URL,
  NEXT_PUBLIC_FORMBRICKS_ENVIRONMENT_ID,
} from "@calcom/lib/public-env";

export const trackFormbricksAction = (eventName: string, properties: Record<string, string> = {}) => {
  if (NEXT_PUBLIC_FORMBRICKS_HOST_URL && NEXT_PUBLIC_FORMBRICKS_ENVIRONMENT_ID) {
    formbricks.track(eventName, properties);
  }
};
