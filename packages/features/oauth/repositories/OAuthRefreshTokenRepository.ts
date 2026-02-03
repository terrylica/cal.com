import type { PrismaClient } from "@calcom/prisma";

export class OAuthRefreshTokenRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: {
    secret: string;
    clientId: string;
    userId?: number | null;
    teamId?: number | null;
    expiresInSeconds: number;
  }): Promise<void> {
    await this.prisma.oAuthRefreshToken.create({
      data: {
        secret: input.secret,
        clientId: input.clientId,
        userId: input.userId,
        teamId: input.teamId,
        expiresAt: new Date(Date.now() + input.expiresInSeconds * 1000),
      },
    });
  }

  async findBySecret(secret: string) {
    return this.prisma.oAuthRefreshToken.findUnique({
      where: { secret },
      select: {
        id: true,
        clientId: true,
        userId: true,
        teamId: true,
      },
    });
  }

  async rotateToken(input: {
    clientId: string;
    userId?: number | null;
    teamId?: number | null;
    newSecret: string;
    expiresInSeconds: number;
  }): Promise<void> {
    const { clientId, userId, teamId, newSecret, expiresInSeconds } = input;
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);
    await this.prisma.$transaction([
      this.prisma.oAuthRefreshToken.deleteMany({
        where: {
          clientId,
          ...(userId != null ? { userId } : {}),
          ...(teamId != null ? { teamId } : {}),
        },
      }),
      this.prisma.oAuthRefreshToken.create({
        data: {
          secret: newSecret,
          clientId,
          userId,
          teamId,
          expiresAt,
        },
      }),
    ]);
  }

  async deleteExpired(): Promise<void> {
    await this.prisma.oAuthRefreshToken.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });
  }
}
