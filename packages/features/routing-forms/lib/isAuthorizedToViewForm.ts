import type { Prisma } from "@calcom/prisma/client";
import { userMetadata } from "@calcom/prisma/zod-utils";

type FormUser = {
  username: string | null;
  metadata: Prisma.JsonValue;
  movedToProfileId: number | null;
  profile: {
    organization: {
      slug: string | null;
      requestedSlug: string | null;
      customDomain?: { slug: string } | null;
    } | null;
  };
  id: number;
};

type FormTeam = {
  parent: {
    slug: string | null;
    customDomain?: { slug: string } | null;
  } | null;
} | null;

export function isAuthorizedToViewFormOnOrgDomain({
  user,
  currentOrgDomain,
  team,
}: {
  user: FormUser;
  currentOrgDomain: string | null;
  team?: FormTeam;
}) {
  const formUser = {
    ...user,
    metadata: userMetadata.parse(user.metadata),
  };
  const orgSlug = formUser.profile.organization?.slug ?? formUser.profile.organization?.requestedSlug ?? null;
  const orgCustomDomain = formUser.profile.organization?.customDomain?.slug ?? null;
  const teamOrgSlug = team?.parent?.slug ?? null;
  const teamOrgCustomDomain = team?.parent?.customDomain?.slug ?? null;

  if (!currentOrgDomain) {
    return true;
  } else if (
    // If on org domain, allow if:
    // 1. The form belongs to a user who is part of the organization (orgSlug or orgCustomDomain matches)
    // 2. The form belongs to a team that is part of the organization (teamOrgSlug or teamOrgCustomDomain matches)
    currentOrgDomain === orgSlug ||
    currentOrgDomain === teamOrgSlug ||
    currentOrgDomain === orgCustomDomain ||
    currentOrgDomain === teamOrgCustomDomain
  ) {
    return true;
  }
  return false;
}
