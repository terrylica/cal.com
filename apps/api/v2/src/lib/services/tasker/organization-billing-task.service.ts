import { OrganizationBillingTaskService as BaseOrganizationBillingTaskService } from "@calcom/platform-libraries/organizations";
import { Injectable } from "@nestjs/common";
import { OrgUsersBillingRepository } from "@/lib/repositories/org-users-billing.repository";

@Injectable()
export class OrganizationBillingTaskService extends BaseOrganizationBillingTaskService {
  constructor(orgUsersBillingRepository: OrgUsersBillingRepository) {
    super({
      orgUsersBillingRepository,
    });
  }
}
