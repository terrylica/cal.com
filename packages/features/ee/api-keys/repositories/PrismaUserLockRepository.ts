import type { PrismaClient } from "@calcom/prisma";
import type { UserLockReason } from "@calcom/prisma/enums";

export class PrismaUserLockRepository {
  constructor(private prismaClient: PrismaClient) {}

  async create({ userId, reason }: { userId: number; reason: UserLockReason }) {
    return this.prismaClient.userLock.create({
      data: {
        userId,
        reason,
      },
      select: {
        id: true,
        userId: true,
        reason: true,
        createdAt: true,
      },
    });
  }

  async findByUserId({ userId }: { userId: number }) {
    return this.prismaClient.userLock.findMany({
      where: { userId },
      select: {
        id: true,
        userId: true,
        reason: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async findUserEmailAndName({ userId }: { userId: number }) {
    return this.prismaClient.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        email: true,
        name: true,
      },
    });
  }

  async updateLockedStatus({ userId, locked }: { userId: number; locked: boolean }) {
    return this.prismaClient.user.update({
      where: { id: userId },
      data: { locked },
      select: {
        id: true,
        email: true,
        username: true,
      },
    });
  }

  async lockUserByEmail({ email }: { email: string }) {
    return this.prismaClient.user.update({
      where: { email },
      data: { locked: true },
      select: {
        id: true,
        email: true,
        username: true,
      },
    });
  }

  async findUserByApiKeyHash({ hashedKey }: { hashedKey: string }) {
    return this.prismaClient.apiKey.findUnique({
      where: { hashedKey },
      select: {
        user: {
          select: {
            id: true,
            email: true,
            username: true,
          },
        },
      },
    });
  }
}
