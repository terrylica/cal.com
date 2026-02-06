import { prisma } from "@calcom/prisma";
import type { BillingModel, BillingPeriod } from "@calcom/prisma/enums";

export interface BillingModelRecord {
  billingModel: BillingModel;
  billingPeriod: BillingPeriod | null;
}

const billingModelSelect = { billingModel: true, billingPeriod: true } as const;

export class BillingModelRepository {
  async findBySubscriptionId(
    subscriptionId: string
  ): Promise<BillingModelRecord | null> {
    const teamBilling = await prisma.teamBilling.findUnique({
      where: { subscriptionId },
      select: billingModelSelect,
    });

    if (teamBilling) return teamBilling;

    const orgBilling = await prisma.organizationBilling.findUnique({
      where: { subscriptionId },
      select: billingModelSelect,
    });

    return orgBilling ?? null;
  }

  async findByTeamId(teamId: number): Promise<BillingModelRecord | null> {
    const teamBilling = await prisma.teamBilling.findUnique({
      where: { teamId },
      select: billingModelSelect,
    });

    if (teamBilling) return teamBilling;

    const orgBilling = await prisma.organizationBilling.findUnique({
      where: { teamId },
      select: billingModelSelect,
    });

    return orgBilling ?? null;
  }
}
