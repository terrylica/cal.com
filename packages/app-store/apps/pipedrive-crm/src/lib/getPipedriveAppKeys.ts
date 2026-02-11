import { z } from "zod";

import getAppKeysFromSlug from "@calcom/app-store/_utils/getAppKeysFromSlug";

const pipedriveAppKeysSchema = z.object({
  client_id: z.string(),
  client_secret: z.string(),
});

export const getPipedriveAppKeys = async () => {
  const appKeys = await getAppKeysFromSlug("pipedrive-crm");
  return pipedriveAppKeysSchema.parse(appKeys);
};
