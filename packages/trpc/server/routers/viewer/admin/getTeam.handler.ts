import { TeamRepository } from "@calcom/features/ee/teams/repositories/TeamRepository";
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
  const teamRepo = new TeamRepository(prisma);
  return await teamRepo.adminFindByIdIncludeMembers({ id: input.id });
};

export default getTeamHandler;
