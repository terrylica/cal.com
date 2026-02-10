import { getCustomDomainService } from "@calcom/features/custom-domains/di/CustomDomainService.container";
import { MembershipRole } from "@calcom/prisma/enums";

import type { TrpcSessionUser } from "../../../types";
import { checkPermissions } from "./customDomain._auth-middleware";
import type { TGetInputSchema } from "./customDomain.get.schema";

type GetHandlerOptions = {
  ctx: {
    user: Pick<NonNullable<TrpcSessionUser>, "id">;
  };
  input: TGetInputSchema;
};

export const getHandler = async ({ ctx, input }: GetHandlerOptions) => {
  await checkPermissions({
    userId: ctx.user.id,
    teamId: input.teamId,
    allowedRoles: [MembershipRole.OWNER, MembershipRole.ADMIN, MembershipRole.MEMBER],
  });

  const service = getCustomDomainService();

  return service.getDomain(input.teamId);
};

export default getHandler;
