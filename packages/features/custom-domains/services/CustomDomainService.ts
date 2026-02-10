import { createDomain as createDomainOnVercel, deleteDomain as deleteDomainOnVercel, getConfig, getDomain, verifyDomain as verifyDomainOnVercel, type VercelConfigResponse, type VercelDomainResponse } from "@calcom/lib/domainManager/deploymentServices/vercel";
import { ErrorWithCode } from "@calcom/lib/errors";

import type { CustomDomainRepository } from "../repositories/CustomDomainRepository";

export const DomainVerificationStatus = {
  VALID: "VALID",
  PENDING: "PENDING",
  NOT_FOUND: "NOT_FOUND",
  INVALID_CONFIGURATION: "INVALID_CONFIGURATION",
  CONFLICTING_DNS: "CONFLICTING_DNS",
  UNKNOWN_ERROR: "UNKNOWN_ERROR",
} as const;

export type DomainVerificationStatus = (typeof DomainVerificationStatus)[keyof typeof DomainVerificationStatus];

export interface DomainVerificationResult {
  status: DomainVerificationStatus;
  domainJson?: VercelDomainResponse;
  configJson?: VercelConfigResponse;
  verificationJson?: VercelDomainResponse;
}

const DOMAIN_REGEX = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;

export interface ICustomDomainServiceDeps {
  customDomainRepository: CustomDomainRepository;
}

export class CustomDomainService {
  constructor(private readonly deps: ICustomDomainServiceDeps) {}

  async addDomain(input: { teamId: number; slug: string }) {
    const normalizedSlug = input.slug.toLowerCase().trim();

    if (!DOMAIN_REGEX.test(normalizedSlug)) {
      throw ErrorWithCode.Factory.BadRequest("Invalid domain format");
    }

    const existingTeamDomain = await this.deps.customDomainRepository.findByTeamId(input.teamId);
    if (existingTeamDomain) {
      throw ErrorWithCode.Factory.BadRequest("Team already has a custom domain configured");
    }

    const existingDomain = await this.deps.customDomainRepository.existsBySlug(normalizedSlug);
    if (existingDomain) {
      throw ErrorWithCode.Factory.BadRequest("Domain is already in use");
    }

    await createDomainOnVercel(normalizedSlug);

    const domain = await this.deps.customDomainRepository.create({
      teamId: input.teamId,
      slug: normalizedSlug,
    });

    return domain;
  }

  async removeDomain(input: { teamId: number }) {
    const domain = await this.deps.customDomainRepository.findByTeamId(input.teamId);
    if (!domain) {
      throw ErrorWithCode.Factory.NotFound("No custom domain found for this team");
    }

    await deleteDomainOnVercel(domain.slug);

    await this.deps.customDomainRepository.delete(domain.id);

    return { success: true };
  }

  async getDomain(teamId: number) {
    return this.deps.customDomainRepository.findByTeamId(teamId);
  }

  async verifyDomainStatus(teamId: number): Promise<DomainVerificationResult & { domain: string | null }> {
    const domain = await this.deps.customDomainRepository.findByTeamId(teamId);
    if (!domain) {
      return {
        status: DomainVerificationStatus.NOT_FOUND,
        domain: null,
      };
    }

    const result = await this.checkVercelDomainStatus(domain.slug);

    const isVerified = result.status === DomainVerificationStatus.VALID;
    if (domain.verified !== isVerified) {
      await this.deps.customDomainRepository.updateVerificationStatus(domain.id, isVerified);
    }

    return {
      ...result,
      domain: domain.slug,
    };
  }

  private async checkVercelDomainStatus(slug: string): Promise<DomainVerificationResult> {
    const [domainJson, configJson] = await Promise.all([getDomain(slug), getConfig(slug)]);

    if (domainJson?.error?.code === "not_found") {
      return { status: DomainVerificationStatus.NOT_FOUND, domainJson, configJson };
    }

    if (domainJson?.error) {
      return { status: DomainVerificationStatus.UNKNOWN_ERROR, domainJson, configJson };
    }

    if (configJson?.conflicts && configJson.conflicts.length > 0) {
      return { status: DomainVerificationStatus.CONFLICTING_DNS, domainJson, configJson };
    }

    if (!domainJson.verified) {
      const verificationJson = await verifyDomainOnVercel(slug);

      if (verificationJson?.verified) {
        return { status: DomainVerificationStatus.VALID, domainJson, configJson, verificationJson };
      }

      return { status: DomainVerificationStatus.PENDING, domainJson, configJson, verificationJson };
    }

    if (configJson?.misconfigured) {
      return { status: DomainVerificationStatus.INVALID_CONFIGURATION, domainJson, configJson };
    }

    return { status: DomainVerificationStatus.VALID, domainJson, configJson };
  }

}
