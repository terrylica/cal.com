import type { OrgUsersBillingRepository } from "@calcom/features/ee/organizations/repositories/OrgUsersBillingRepository";

export interface IOrganizationBillingTaskServiceDependencies {
  orgUsersBillingRepository: OrgUsersBillingRepository;
}

export class OrganizationBillingTaskService {
  constructor(private readonly dependencies: IOrganizationBillingTaskServiceDependencies) {}

  async getActiveUsersCount(organizationId: number, periodStart: number, periodEnd: number): Promise<number> {
    const { orgUsersBillingRepository } = this.dependencies;

    const startDate = new Date(periodStart * 1000);
    const endDate = new Date(periodEnd * 1000);

    const userEmails = await orgUsersBillingRepository.getUserEmailsByOrgId(organizationId);

    if (!userEmails || userEmails.length === 0) {
      return 0;
    }

    const activeUserEmailsAsHost = await orgUsersBillingRepository.getActiveUsersAsHost(
      organizationId,
      startDate,
      endDate
    );

    const activeHostEmailsSet = new Set(activeUserEmailsAsHost.map((user) => user.email));
    const notActiveHostEmails = userEmails
      .filter((user) => !activeHostEmailsSet.has(user.email))
      .map((user) => user.email);

    let activeCount = activeUserEmailsAsHost.length;

    if (notActiveHostEmails.length > 0) {
      const activeUserEmailsAsAttendee = await orgUsersBillingRepository.getActiveUsersAsAttendee(
        notActiveHostEmails,
        startDate,
        endDate
      );
      activeCount += activeUserEmailsAsAttendee.length;
    }

    return activeCount;
  }
}
