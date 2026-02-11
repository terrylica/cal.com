import getParsedAppKeysFromSlug from "@calcom/app-store/_utils/getParsedAppKeysFromSlug";
import { appKeysSchema } from "../zod";

export const getStripeAppKeys = () => getParsedAppKeysFromSlug("stripe", appKeysSchema);
