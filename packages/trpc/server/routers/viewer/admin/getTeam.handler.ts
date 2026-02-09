import { prisma } from "@calcom/prisma";
import type { TrpcSessionUser } from "../../../types";
import type { TAdminGetTeamSchema } from "./getTeam.schema";

type GetOptions = {
  ctx: {
    user: NonNullable<TrpcSessionUser>;
  };
  input: TAdminGetTeamSchema;
};

const getTeamHandler = async ({ input }: GetOptions) => {
  const team = await prisma.team.findUniqueOrThrow({
    where: { id: input.id },
    select: {
      id: true,
      name: true,
      slug: true,
      bio: true,
      logoUrl: true,
      hideBranding: true,
      hideBookATeamMember: true,
      isPrivate: true,
      timeZone: true,
      weekStart: true,
      timeFormat: true,
      theme: true,
      brandColor: true,
      darkBrandColor: true,
      parentId: true,
      isOrganization: true,
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
          role: true,
          accepted: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              username: true,
            },
          },
        },
      },
    },
  });

  return team;
};

export default getTeamHandler;
