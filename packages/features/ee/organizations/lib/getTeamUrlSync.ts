import { getBookerBaseUrlSync } from "@calcom/features/ee/organizations/lib/getBookerBaseUrlSync";

export const getTeamUrlSync = (
  {
    orgSlug,
    teamSlug,
    customDomain,
  }: {
    orgSlug: string | null;
    teamSlug: string | null;
    customDomain?: string | null;
  },
  options?: {
    protocol?: boolean;
  }
) => {
  const bookerUrl = getBookerBaseUrlSync(orgSlug, { ...options, customDomain });
  teamSlug = teamSlug || "";
  if (orgSlug || customDomain) {
    return `${bookerUrl}/${teamSlug}`;
  }
  return `${bookerUrl}/team/${teamSlug}`;
};
