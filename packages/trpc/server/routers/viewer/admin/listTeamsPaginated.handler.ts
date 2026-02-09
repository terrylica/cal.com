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
  const { cursor, limit, searchTerm } = input;

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

  const totalCount = await prisma.team.count({ where });

  const teams = await prisma.team.findMany({
    cursor: cursor ? { id: cursor } : undefined,
    take: limit + 1,
    where,
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
  });

  let nextCursor: typeof cursor | undefined;
  if (teams && teams.length > limit) {
    const nextItem = teams.pop();
    nextCursor = nextItem?.id;
  }

  const rows = teams.map((team) => ({
    ...team,
    memberCount: team.members.length,
    members: undefined,
  }));

  return {
    rows,
    nextCursor,
    meta: {
      totalRowCount: totalCount,
    },
  };
};

export default listTeamsPaginatedHandler;
