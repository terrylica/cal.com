import { PrismaReadService } from "@/modules/prisma/prisma-read.service";
import { Injectable } from "@nestjs/common";

import { BookingAccessService as PlatformBookingAccessService } from "@calcom/platform-libraries";
import type { PrismaClient } from "@calcom/prisma";

@Injectable()
export class BookingAccessService extends PlatformBookingAccessService {
  constructor(private readonly prismaReadService: PrismaReadService) {
    super(prismaReadService.prisma as unknown as PrismaClient);
  }
}
