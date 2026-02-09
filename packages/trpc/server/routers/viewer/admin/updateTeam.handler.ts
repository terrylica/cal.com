import { prisma } from "@calcom/prisma";
import type { TrpcSessionUser } from "../../../types";
import type { TAdminUpdateTeamSchema } from "./updateTeam.schema";

type UpdateOptions = {
  ctx: {
    user: NonNullable<TrpcSessionUser>;
  };
  input: TAdminUpdateTeamSchema;
};

const updateTeamHandler = async ({ input }: UpdateOptions) => {
  const { id, ...data } = input;

  const team = await prisma.team.update({
    where: { id },
    data,
    select: {
      id: true,
      name: true,
      slug: true,
    },
  });

  return team;
};

export default updateTeamHandler;
