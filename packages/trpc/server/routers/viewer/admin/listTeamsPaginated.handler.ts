import { prisma } from "@calcom/prisma";
import type { Prisma } from "@calcom/prisma/client";

import type { TrpcSessionUser } from "../../../types";
import type { TListTeamsPaginatedSchema } from "./listTeamsPaginated.schema";

type GetOptions = {
  ctx: {
    user: NonNullable<TrpcSessionUser>;
  };
  input: TListTeamsPaginatedSchema;
};

const listTeamsPaginatedHandler = async ({ input }: GetOptions) => {
  const { limit, offset, searchTerm } = input;

  const where: Prisma.TeamWhereInput = {
    isOrganization: false,
  };

  if (searchTerm) {
    where.OR = [
      {
        name: {
          contains: searchTerm,
          mode: "insensitive",
        },
      },
      {
        slug: {
          contains: searchTerm,
          mode: "insensitive",
        },
      },
    ];
  }

  const [totalCount, teams] = await Promise.all([
    prisma.team.count({ where }),
    prisma.team.findMany({
      where,
      skip: offset,
      take: limit,
      orderBy: {
        id: "asc",
      },
      select: {
        id: true,
        name: true,
        slug: true,
        bio: true,
        logoUrl: true,
        timeZone: true,
        hideBranding: true,
        isPrivate: true,
        parentId: true,
        createdAt: true,
        parent: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        members: {
          select: {
            id: true,
          },
        },
      },
    }),
  ]);

  const rows = teams.map((team) => ({
    ...team,
    memberCount: team.members.length,
    members: undefined,
  }));

  return {
    rows,
    meta: {
      totalRowCount: totalCount,
    },
  };
};

export default listTeamsPaginatedHandler;
