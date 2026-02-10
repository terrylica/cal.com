import { getCustomDomainService } from "@calcom/features/custom-domains/di/CustomDomainService.container";
import { MembershipRole } from "@calcom/prisma/enums";

import type { TrpcSessionUser } from "../../../types";
import { checkPermissions } from "./customDomain._auth-middleware";
import type { TAddInputSchema } from "./customDomain.add.schema";

type AddHandlerOptions = {
  ctx: {
    user: Pick<NonNullable<TrpcSessionUser>, "id">;
  };
  input: TAddInputSchema;
};

export const addHandler = async ({ ctx, input }: AddHandlerOptions) => {
  await checkPermissions({
    userId: ctx.user.id,
    teamId: input.teamId,
    allowedRoles: [MembershipRole.OWNER, MembershipRole.ADMIN],
  });

  const service = getCustomDomainService();

  return service.addDomain({
    teamId: input.teamId,
    slug: input.slug,
  });
};

export default addHandler;
