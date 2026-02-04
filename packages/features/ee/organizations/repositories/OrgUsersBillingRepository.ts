import type { PrismaClient } from "@calcom/prisma/client";

export class OrgUsersBillingRepository {
  constructor(private readonly prismaClient: PrismaClient) {}

  async getUserEmailsByOrgId(organizationId: number): Promise<{ email: string }[]> {
    return this.prismaClient.user.findMany({
      distinct: ["email"],
      where: {
        profiles: {
          some: {
            organizationId,
          },
        },
      },
      select: {
        email: true,
      },
    });
  }

  async getActiveUsersAsHost(
    organizationId: number,
    startTime: Date,
    endTime: Date
  ): Promise<{ email: string }[]> {
    return this.prismaClient.user.findMany({
      distinct: ["email"],
      where: {
        profiles: {
          some: {
            organizationId,
          },
        },
        bookings: {
          some: {
            userId: { not: null },
            startTime: {
              gte: startTime,
              lte: endTime,
            },
          },
        },
      },
      select: {
        email: true,
      },
    });
  }

  async getActiveUsersAsAttendee(
    userEmails: string[],
    startTime: Date,
    endTime: Date
  ): Promise<{ email: string }[]> {
    return this.prismaClient.attendee.findMany({
      distinct: ["email"],
      where: {
        email: { in: userEmails },
        booking: {
          startTime: {
            gte: startTime,
            lte: endTime,
          },
        },
      },
      select: {
        email: true,
      },
    });
  }
}
