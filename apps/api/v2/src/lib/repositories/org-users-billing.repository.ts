import { OrgUsersBillingRepository as BaseOrgUsersBillingRepository } from "@calcom/platform-libraries/organizations";
import type { PrismaClient } from "@calcom/prisma";
import { Injectable } from "@nestjs/common";
import { PrismaReadService } from "@/modules/prisma/prisma-read.service";

@Injectable()
export class OrgUsersBillingRepository extends BaseOrgUsersBillingRepository {
  constructor(dbRead: PrismaReadService) {
    super(dbRead.prisma as unknown as PrismaClient);
  }
}
