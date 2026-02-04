import type { IBillingProviderService } from "@calcom/features/ee/billing/service/billingProvider/IBillingProviderService";
import type { OrganizationRepository } from "@calcom/features/ee/organizations/repositories/OrganizationRepository";
import type { ITaskerDependencies } from "@calcom/lib/tasker/types";
import type { OrganizationBillingTaskService } from "./OrganizationBillingTaskService";
import type { PlatformOrganizationBillingTaskService } from "./PlatformOrganizationBillingTaskService";
import type { CountActiveUsersPayload, InvoiceActiveUsersPayload } from "./types";

export interface IActiveUsersBillingTaskServiceDependencies {
  organizationRepository: OrganizationRepository;
  platformBillingTaskService: PlatformOrganizationBillingTaskService;
  organizationBillingTaskService: OrganizationBillingTaskService;
  billingProviderService: Pick<
    IBillingProviderService,
    "createCustomer" | "createInvoiceItem" | "createInvoice" | "finalizeInvoice"
  >;
}

export class ActiveUsersBillingTaskService {
  constructor(
    private readonly dependencies: {
      logger: ITaskerDependencies["logger"];
    } & IActiveUsersBillingTaskServiceDependencies
  ) {}

  async getActiveUsersCount(organizationId: number, periodStart: number, periodEnd: number): Promise<number> {
    const { organizationRepository, platformBillingTaskService, organizationBillingTaskService } =
      this.dependencies;

    const org = await organizationRepository.findByOrgId(organizationId);

    if (!org) {
      return 0;
    }

    const isPlatform = org.isPlatform && org.isOrganization;

    if (isPlatform) {
      return platformBillingTaskService.getActiveManagedUsersCount(organizationId, periodStart, periodEnd);
    }

    return organizationBillingTaskService.getActiveUsersCount(organizationId, periodStart, periodEnd);
  }

  async countActiveUsers(payload: CountActiveUsersPayload): Promise<void> {
    const { organizationId, periodStart, periodEnd } = payload;
    const { logger } = this.dependencies;

    const activeCount = await this.getActiveUsersCount(organizationId, periodStart, periodEnd);

    logger.info("Counted active users for organization", {
      organizationId,
      periodStart: new Date(periodStart * 1000).toISOString(),
      periodEnd: new Date(periodEnd * 1000).toISOString(),
      activeUsers: activeCount,
    });
  }

  async invoiceActiveUsers(payload: InvoiceActiveUsersPayload): Promise<void> {
    const {
      organizationIds,
      periodStart,
      periodEnd,
      billingEmail,
      pricePerUserInCents,
      currency,
      stripeCustomerId: existingCustomerId,
    } = payload;
    const { billingProviderService, logger } = this.dependencies;

    let totalActiveUsers = 0;
    for (const organizationId of organizationIds) {
      const count = await this.getActiveUsersCount(organizationId, periodStart, periodEnd);
      logger.info("Counted active users for org", { organizationId, activeCount: count });
      totalActiveUsers += count;
    }

    if (totalActiveUsers === 0) {
      logger.info("No active users found across all organizations, skipping invoice creation", {
        organizationIds,
      });
      return;
    }

    const stripeCustomerId =
      existingCustomerId ??
      (
        await billingProviderService.createCustomer({
          email: billingEmail,
          metadata: {
            source: "active-users-billing",
            organizationIds: organizationIds.join(","),
          },
        })
      ).stripeCustomerId;

    logger.info("Using Stripe customer for active users invoice", {
      stripeCustomerId,
      hasBillingEmail: Boolean(billingEmail),
      wasCreated: !existingCustomerId,
    });

    const totalAmount = totalActiveUsers * pricePerUserInCents;
    const periodStartISO = new Date(periodStart * 1000).toISOString();
    const periodEndISO = new Date(periodEnd * 1000).toISOString();

    const { invoiceId } = await billingProviderService.createInvoice({
      customerId: stripeCustomerId,
      autoAdvance: false,
      collectionMethod: "send_invoice",
      daysUntilDue: 30,
      pendingInvoiceItemsBehavior: "exclude",
      metadata: {
        source: "active-users-billing",
        periodStart: periodStartISO,
        periodEnd: periodEndISO,
        organizationIds: organizationIds.join(","),
      },
    });

    await billingProviderService.createInvoiceItem({
      customerId: stripeCustomerId,
      amount: totalAmount,
      currency,
      description: `Active users billing (${periodStartISO} - ${periodEndISO}): ${totalActiveUsers} users`,
      invoiceId,
      metadata: {
        activeUsers: String(totalActiveUsers),
        pricePerUser: String(pricePerUserInCents),
      },
    });

    const { invoiceUrl } = await billingProviderService.finalizeInvoice(invoiceId);

    logger.info("Created and finalized active users invoice", {
      invoiceId,
      invoiceUrl,
      stripeCustomerId,
      totalActiveUsers,
      totalAmount,
      currency,
      organizationIds,
    });
  }
}
