import type { PrismaClient } from "@calcom/prisma";

import type { CustomDomainWithTeam } from "../lib/types";

const customDomainSelect = {
  id: true,
  teamId: true,
  slug: true,
  verified: true,
  lastCheckedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

const customDomainWithTeamSelect = {
  ...customDomainSelect,
  team: {
    select: {
      id: true,
      slug: true,
      name: true,
    },
  },
} as const;

export class CustomDomainRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string) {
    return this.prisma.customDomain.findUnique({
      where: { id },
      select: customDomainSelect,
    });
  }

  async findBySlug(slug: string) {
    return this.prisma.customDomain.findUnique({
      where: { slug: slug.toLowerCase() },
      select: customDomainSelect,
    });
  }

  async findBySlugWithTeam(slug: string): Promise<CustomDomainWithTeam | null> {
    return this.prisma.customDomain.findUnique({
      where: { slug: slug.toLowerCase() },
      select: customDomainWithTeamSelect,
    });
  }

  async findByTeamId(teamId: number) {
    return this.prisma.customDomain.findUnique({
      where: { teamId },
      select: customDomainSelect,
    });
  }

  async create(data: { teamId: number; slug: string }) {
    return this.prisma.customDomain.create({
      data: {
        teamId: data.teamId,
        slug: data.slug.toLowerCase(),
        verified: false,
      },
      select: customDomainSelect,
    });
  }

  async updateVerificationStatus(id: string, verified: boolean) {
    return this.prisma.customDomain.update({
      where: { id },
      data: {
        verified,
        lastCheckedAt: new Date(),
      },
      select: customDomainSelect,
    });
  }

  async delete(id: string) {
    return this.prisma.customDomain.delete({
      where: { id },
      select: customDomainSelect,
    });
  }

  async deleteByTeamId(teamId: number) {
    return this.prisma.customDomain.delete({
      where: { teamId },
      select: customDomainSelect,
    });
  }

  async existsBySlug(slug: string): Promise<boolean> {
    const domain = await this.prisma.customDomain.findUnique({
      where: { slug: slug.toLowerCase() },
      select: { id: true },
    });
    return domain !== null;
  }

  async getUnverifiedDomainsForCheck(limit: number = 30) {
    return this.prisma.customDomain.findMany({
      where: { verified: false },
      orderBy: { lastCheckedAt: "asc" },
      take: limit,
      select: customDomainWithTeamSelect,
    });
  }
}
