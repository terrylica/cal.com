import type { PrismaClient } from "@calcom/prisma";
import { prisma as defaultPrisma } from "@calcom/prisma";
import type { BillingModel, BillingPeriod } from "@calcom/prisma/enums";

export interface BillingModelRecord {
  billingModel: BillingModel;
  billingPeriod: BillingPeriod | null;
}

const billingModelSelect = { billingModel: true, billingPeriod: true } as const;

export class BillingModelRepository {
  private prisma: PrismaClient;

  constructor(prisma?: PrismaClient) {
    this.prisma = prisma || defaultPrisma;
  }

  async findBySubscriptionId(
    subscriptionId: string
  ): Promise<BillingModelRecord | null> {
    const teamBilling = await this.prisma.teamBilling.findUnique({
      where: { subscriptionId },
      select: billingModelSelect,
    });

    if (teamBilling) return teamBilling;

    const orgBilling = await this.prisma.organizationBilling.findUnique({
      where: { subscriptionId },
      select: billingModelSelect,
    });

    return orgBilling ?? null;
  }

  async findByTeamId(teamId: number): Promise<BillingModelRecord | null> {
    const teamBilling = await this.prisma.teamBilling.findUnique({
      where: { teamId },
      select: billingModelSelect,
    });

    if (teamBilling) return teamBilling;

    const orgBilling = await this.prisma.organizationBilling.findUnique({
      where: { teamId },
      select: billingModelSelect,
    });

    return orgBilling ?? null;
  }
}
