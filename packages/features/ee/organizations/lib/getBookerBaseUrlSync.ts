import { getOrgFullOrigin } from "@calcom/ee/organizations/lib/orgDomains";

export const getBookerBaseUrlSync = (
  orgSlug: string | null,
  options?: {
    protocol?: boolean;
    customDomain?: string | null;
  }
) => {
  const { customDomain, ...rest } = options ?? {};
  if (customDomain) {
    return getOrgFullOrigin(customDomain, { ...rest, isCustomDomain: true });
  }
  return getOrgFullOrigin(orgSlug ?? "", rest);
};
