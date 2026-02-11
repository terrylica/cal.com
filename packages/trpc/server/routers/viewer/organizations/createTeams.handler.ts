import { createTeams } from "@calcom/features/ee/organizations/lib/createTeams";

import type { TCreateTeamsSchema } from "./createTeams.schema";

type CreateTeamsOptions = {
  ctx: {
    user: {
      id: number;
      organizationId: number | null;
    };
  };
  input: TCreateTeamsSchema;
};

export const createTeamsHandler = async ({ ctx, input }: CreateTeamsOptions) => {
  return createTeams({ ctx, input });
};

export default createTeamsHandler;
