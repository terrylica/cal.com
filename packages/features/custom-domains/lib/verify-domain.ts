import type { DomainVerificationResult, DomainVerificationStatus } from "./types";
import { getConfigFromVercel, getDomainFromVercel, verifyDomainOnVercel } from "./vercel-api";

export async function verifyDomain(domain: string): Promise<DomainVerificationResult> {
  const [domainJson, configJson] = await Promise.all([
    getDomainFromVercel(domain),
    getConfigFromVercel(domain),
  ]);

  if (domainJson?.error?.code === "not_found") {
    return {
      status: "Domain Not Found",
      domainJson,
      configJson,
    };
  }

  if (domainJson?.error) {
    return {
      status: "Unknown Error",
      domainJson,
      configJson,
    };
  }

  if (configJson?.conflicts && configJson.conflicts.length > 0) {
    return {
      status: "Conflicting DNS Records",
      domainJson,
      configJson,
    };
  }

  if (!domainJson.verified) {
    const verificationJson = await verifyDomainOnVercel(domain);

    if (verificationJson?.verified) {
      return {
        status: "Valid Configuration",
        domainJson,
        configJson,
        verificationJson,
      };
    }

    return {
      status: "Pending Verification",
      domainJson,
      configJson,
      verificationJson,
    };
  }

  if (configJson?.misconfigured) {
    return {
      status: "Invalid Configuration",
      domainJson,
      configJson,
    };
  }

  return {
    status: "Valid Configuration",
    domainJson,
    configJson,
  };
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
