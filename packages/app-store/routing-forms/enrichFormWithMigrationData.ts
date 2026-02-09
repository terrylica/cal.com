import { getOrgFullOrigin } from "@calcom/features/ee/organizations/lib/orgDomains";
import { WEBAPP_URL } from "@calcom/lib/constants";
import { teamMetadataSchema, userMetadata } from "@calcom/prisma/zod-utils";

export const enrichFormWithMigrationData = <
  T extends {
    user: {
      movedToProfileId: number | null;
      metadata?: unknown;
      username: string | null;
      nonProfileUsername: string | null;
      profile: {
        organization: {
          slug: string | null;
          customDomain?: { slug: string } | null;
        } | null;
      };
    };
    team: {
      parent: {
        slug: string | null;
        customDomain?: { slug: string } | null;
      } | null;
      metadata?: unknown;
    } | null;
  }
>(
  form: T
) => {
  const parsedUserMetadata = userMetadata.parse(form.user.metadata ?? null);
  const parsedTeamMetadata = teamMetadataSchema.parse(form.team?.metadata ?? null);
  const formOwnerOrgSlug = form.user.profile.organization?.slug ?? null;
  const formOwnerOrgCustomDomain = form.user.profile.organization?.customDomain?.slug ?? null;
  const nonOrgUsername = parsedUserMetadata?.migratedToOrgFrom?.username ?? form.user.nonProfileUsername;
  const nonOrgTeamslug = parsedTeamMetadata?.migratedToOrgFrom?.teamSlug ?? null;

  return {
    ...form,
    user: {
      ...form.user,
      metadata: parsedUserMetadata,
    },
    team: {
      ...form.team,
      metadata: teamMetadataSchema.parse(form.team?.metadata ?? null),
    },
    userOrigin: formOwnerOrgSlug
      ? getOrgFullOrigin(formOwnerOrgCustomDomain ?? formOwnerOrgSlug, {
          protocol: true,
          isCustomDomain: !!formOwnerOrgCustomDomain,
        })
      : WEBAPP_URL,
    teamOrigin: form.team?.parent?.slug
      ? getOrgFullOrigin(form.team.parent.customDomain?.slug ?? form.team.parent.slug, {
          protocol: true,
          isCustomDomain: !!form.team.parent.customDomain?.slug,
        })
      : WEBAPP_URL,
    nonOrgUsername,
    nonOrgTeamslug,
  };
};
