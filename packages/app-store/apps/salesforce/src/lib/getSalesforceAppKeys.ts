import { z } from "zod";

import getParsedAppKeysFromSlug from "@calcom/app-store/_utils/getParsedAppKeysFromSlug";

const salesforceAppKeysSchema = z.object({
  consumer_key: z.string(),
  consumer_secret: z.string(),
});

export const getSalesforceAppKeys = async () => {
  return getParsedAppKeysFromSlug("salesforce", salesforceAppKeysSchema);
};
