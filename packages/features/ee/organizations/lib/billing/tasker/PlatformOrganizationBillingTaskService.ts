import type { IBillingProviderService } from "@calcom/features/ee/billing/service/billingProvider/IBillingProviderService";
import type { ManagedUsersBillingRepository } from "@calcom/features/ee/organizations/repositories/ManagedUsersBillingRepository";
import type { OrganizationRepository } from "@calcom/features/ee/organizations/repositories/OrganizationRepository";
import type { PlatformBillingRepository } from "@calcom/features/ee/organizations/repositories/PlatformBillingRepository";
import type { ITaskerDependencies } from "@calcom/lib/tasker/types";
import type { PlatformOrganizationBillingTasks } from "./types";

export interface IPlatformOrganizationBillingTaskServiceDependencies {
  organizationRepository: OrganizationRepository;
  platformBillingRepository: PlatformBillingRepository;
  managedUsersBillingRepository: ManagedUsersBillingRepository;
  billingProviderService: Pick<IBillingProviderService, "createSubscriptionUsageRecord">;
}

export class PlatformOrganizationBillingTaskService implements PlatformOrganizationBillingTasks {
  constructor(
    public readonly dependencies: {
      logger: ITaskerDependencies["logger"];
    } & IPlatformOrganizationBillingTaskServiceDependencies
  ) {}

  async incrementUsage(
    payload: Parameters<PlatformOrganizationBillingTasks["incrementUsage"]>[0]
  ): Promise<void> {
    const { userId } = payload;
    const { organizationRepository, platformBillingRepository, billingProviderService, logger } =
      this.dependencies;

    const team = await organizationRepository.findPlatformOrgByUserId(userId);
    const teamId = team?.id;
    if (!teamId) {
      logger.error(`User (${userId}) is not part of the platform organization (${teamId})`, {
        teamId,
        userId,
      });
      return;
    }

    const billingSubscription = await platformBillingRepository.findByTeamId(teamId);
    if (!billingSubscription || !billingSubscription?.subscriptionId) {
      logger.error(`Team ${teamId} did not have stripe subscription associated to it`, {
        teamId,
      });
      return;
    }

    await billingProviderService.createSubscriptionUsageRecord({
      subscriptionId: billingSubscription.subscriptionId,
      action: "increment",
      quantity: 1,
    });

    logger.info("Increased organization usage for subscription", {
      subscriptionId: billingSubscription.subscriptionId,
      teamId,
      userId,
    });
  }

  async getActiveManagedUsersCount(
    organizationId: number,
    periodStart: number,
    periodEnd: number
  ): Promise<number> {
    const { managedUsersBillingRepository } = this.dependencies;

    const startDate = new Date(periodStart * 1000);
    const endDate = new Date(periodEnd * 1000);

    const managedUsersEmails =
      await managedUsersBillingRepository.getManagedUserEmailsByOrgId(organizationId);

    if (!managedUsersEmails || managedUsersEmails.length === 0) {
      return 0;
    }

    const activeManagedUserEmailsAsHost = await managedUsersBillingRepository.getActiveManagedUsersAsHost(
      organizationId,
      startDate,
      endDate
    );

    const activeHostEmailsSet = new Set(activeManagedUserEmailsAsHost.map((user) => user.email));
    const notActiveHostEmails = managedUsersEmails
      .filter((user) => !activeHostEmailsSet.has(user.email))
      .map((user) => user.email);

    let activeCount = activeManagedUserEmailsAsHost.length;

    if (notActiveHostEmails.length > 0) {
      const activeManagedUserEmailsAsAttendee =
        await managedUsersBillingRepository.getActiveManagedUsersAsAttendee(
          notActiveHostEmails,
          startDate,
          endDate
        );
      activeCount += activeManagedUserEmailsAsAttendee.length;
    }

    return activeCount;
  }
}
