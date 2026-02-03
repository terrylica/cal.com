import { PrismaFeaturesRepository } from "@/lib/repositories/prisma-features.repository";
import { Injectable } from "@nestjs/common";

import { PermissionCheckService as PlatformPermissionCheckService } from "@calcom/platform-libraries/pbac";

@Injectable()
export class PermissionCheckService extends PlatformPermissionCheckService {
  constructor(featuresRepository: PrismaFeaturesRepository) {
    super(undefined, featuresRepository);
  }
}
