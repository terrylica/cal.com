import {
  getConfig,
  getDomain,
  verifyDomain as verifyDomainOnVercel,
} from "@calcom/lib/domainManager/deploymentServices/vercel";
import type { DomainVerificationResult } from "./types";
import { DomainVerificationStatus } from "./types";

export async function verifyDomainStatus(domain: string): Promise<DomainVerificationResult> {
  const [domainJson, configJson] = await Promise.all([getDomain(domain), getConfig(domain)]);

  if (domainJson?.error?.code === "not_found") {
    return { status: DomainVerificationStatus.NOT_FOUND, domainJson, configJson };
  }

  if (domainJson?.error) {
    return { status: DomainVerificationStatus.UNKNOWN, domainJson, configJson };
  }

  if (configJson?.conflicts && configJson.conflicts.length > 0) {
    return { status: DomainVerificationStatus.CONFLICTING, domainJson, configJson };
  }

  if (!domainJson.verified) {
    const verificationResult = await verifyDomainOnVercel(domain);

    if (verificationResult?.verified) {
      return { status: DomainVerificationStatus.VALID, domainJson: verificationResult, configJson };
    }

    return { status: DomainVerificationStatus.PENDING, domainJson: verificationResult, configJson };
  }

  if (configJson?.misconfigured) {
    return { status: DomainVerificationStatus.INVALID, domainJson, configJson };
  }

  return { status: DomainVerificationStatus.VALID, domainJson, configJson };
}

export function isValidDomainFormat(domain: string): boolean {
  const domainRegex = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;
  return domainRegex.test(domain);
}

export function getSubdomain(domain: string, apexDomain: string): string | null {
  if (domain === apexDomain) {
    return null;
  }
  return domain.replace(`.${apexDomain}`, "");
}

export function getApexDomain(domain: string): string {
  const parts = domain.split(".");
  if (parts.length <= 2) {
    return domain;
  }
  return parts.slice(-2).join(".");
}
