import type { IncomingMessage } from "node:http";

import { prisma } from "@calcom/prisma";

import { getOrgDomainConfigFromHostname } from "./orgDomains";

function isPlatformRequest(req: IncomingMessage | undefined) {
  return !!req?.headers?.["x-cal-client-id"];
}

export async function getOrgSlugFromCustomDomain(hostname: string): Promise<string | null> {
  const normalizedHostname = hostname.toLowerCase().split(":")[0];

  const customDomain = await prisma.customDomain.findUnique({
    where: { slug: normalizedHostname },
    select: {
      verified: true,
      team: {
        select: {
          slug: true,
        },
      },
    },
  });

  if (!customDomain?.verified || !customDomain.team.slug) {
    return null;
  }

  return customDomain.team.slug;
}

export async function getOrgDomainConfigFromHostnameAsync({
  hostname,
  fallback,
  forcedSlug,
}: {
  hostname: string;
  fallback?: string | string[];
  forcedSlug?: string;
}): Promise<{
  currentOrgDomain: string | null;
  isValidOrgDomain: boolean;
  isCustomDomain: boolean;
}> {
  const customDomainSlug = await getOrgSlugFromCustomDomain(hostname);

  if (customDomainSlug) {
    return {
      currentOrgDomain: customDomainSlug,
      isValidOrgDomain: true,
      isCustomDomain: true,
    };
  }

  const syncResult = getOrgDomainConfigFromHostname({ hostname, fallback, forcedSlug });
  return {
    ...syncResult,
    isCustomDomain: false,
  };
}

export async function orgDomainConfigAsync(
  req: IncomingMessage | undefined,
  fallback?: string | string[]
): Promise<{
  currentOrgDomain: string | null;
  isValidOrgDomain: boolean;
  isCustomDomain: boolean;
}> {
  const forPlatform = isPlatformRequest(req);
  const forcedSlugHeader = req?.headers?.["x-cal-force-slug"];
  const forcedSlug = forcedSlugHeader instanceof Array ? forcedSlugHeader[0] : forcedSlugHeader;

  if (forPlatform && forcedSlug) {
    return {
      isValidOrgDomain: true,
      currentOrgDomain: forcedSlug,
      isCustomDomain: false,
    };
  }

  const hostname = req?.headers?.host || "";
  return getOrgDomainConfigFromHostnameAsync({
    hostname,
    fallback,
    forcedSlug,
  });
}
