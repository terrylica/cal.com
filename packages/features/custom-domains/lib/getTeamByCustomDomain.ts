import { prisma } from "@calcom/prisma";

export async function getTeamByCustomDomain(hostname: string) {
  const normalizedHostname = hostname.toLowerCase();

  const customDomain = await prisma.customDomain.findUnique({
    where: { slug: normalizedHostname },
    select: {
      id: true,
      slug: true,
      verified: true,
      team: {
        select: {
          id: true,
          slug: true,
          name: true,
          isOrganization: true,
          parentId: true,
        },
      },
    },
  });

  if (!customDomain?.verified) {
    return null;
  }

  return customDomain.team;
}

export async function getOrgSlugByCustomDomain(hostname: string): Promise<string | null> {
  const team = await getTeamByCustomDomain(hostname);

  if (!team) {
    return null;
  }

  return team.slug;
}

export async function isCustomDomainHostname(hostname: string): Promise<boolean> {
  const normalizedHostname = hostname.toLowerCase();

  const customDomain = await prisma.customDomain.findUnique({
    where: { slug: normalizedHostname },
    select: { verified: true },
  });

  return customDomain?.verified === true;
}
