import { createDomain, deleteDomain } from "@calcom/lib/domainManager/deploymentServices/vercel";
import { ErrorCode } from "@calcom/lib/errorCodes";
import { ErrorWithCode } from "@calcom/lib/errors";
import type { PrismaClient } from "@calcom/prisma";
import type { DomainVerificationResult } from "../lib/types";
import { DomainVerificationStatus } from "../lib/types";
import { isValidDomainFormat, verifyDomainStatus } from "../lib/verify-domain";
import { CustomDomainRepository } from "../repositories/CustomDomainRepository";

export class CustomDomainService {
  private repository: CustomDomainRepository;

  constructor(private readonly prisma: PrismaClient) {
    this.repository = new CustomDomainRepository(prisma);
  }

  async addDomain(input: { teamId: number; slug: string }) {
    const normalizedSlug = input.slug.toLowerCase().trim();

    if (!isValidDomainFormat(normalizedSlug)) {
      throw new ErrorWithCode(ErrorCode.BadRequest, "Invalid domain format");
    }

    const existingTeamDomain = await this.repository.findByTeamId(input.teamId);
    if (existingTeamDomain) {
      throw new ErrorWithCode(ErrorCode.BadRequest, "Team already has a custom domain configured");
    }

    const existingDomain = await this.repository.existsBySlug(normalizedSlug);
    if (existingDomain) {
      throw new ErrorWithCode(ErrorCode.BadRequest, "Domain is already in use");
    }

    await createDomain(normalizedSlug);

    const domain = await this.repository.create({
      teamId: input.teamId,
      slug: normalizedSlug,
    });

    return domain;
  }

  async removeDomain(input: { teamId: number }) {
    const domain = await this.repository.findByTeamId(input.teamId);
    if (!domain) {
      throw new ErrorWithCode(ErrorCode.NotFound, "No custom domain found for this team");
    }

    await deleteDomain(domain.slug);

    await this.repository.delete(domain.id);

    return { success: true };
  }

  async getDomain(teamId: number) {
    return this.repository.findByTeamId(teamId);
  }

  async getDomainBySlug(slug: string) {
    return this.repository.findBySlugWithTeam(slug.toLowerCase());
  }

  async verifyDomainForTeam(teamId: number): Promise<DomainVerificationResult & { domain: string | null }> {
    const domain = await this.repository.findByTeamId(teamId);
    if (!domain) {
      return { status: DomainVerificationStatus.NOT_FOUND, domain: null };
    }

    const result = await verifyDomainStatus(domain.slug);

    const isVerified = result.status === DomainVerificationStatus.VALID;
    if (domain.verified !== isVerified) {
      await this.repository.updateVerificationStatus(domain.id, isVerified);
    }

    return { ...result, domain: domain.slug };
  }

  async refreshVerificationStatus(id: string, verified: boolean) {
    return this.repository.updateVerificationStatus(id, verified);
  }
}
