import { prisma } from "@calcom/prisma";

export class PrismaAssignmentReasonRepository {
  static async findLatestReasonFromBookingUid(bookingUid: string) {
    return await prisma.assignmentReason.findFirst({
      where: {
        booking: {
          uid: bookingUid,
        },
      },
      select: {
        reasonString: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  }
}
