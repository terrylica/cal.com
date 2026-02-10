import { getCustomDomainService } from "@calcom/features/custom-domains/di/CustomDomainService.container";
import { MembershipRole } from "@calcom/prisma/enums";

import type { TrpcSessionUser } from "../../../types";
import { checkPermissions } from "./customDomain._auth-middleware";
import type { TRemoveInputSchema } from "./customDomain.remove.schema";

type RemoveHandlerOptions = {
  ctx: {
    user: Pick<NonNullable<TrpcSessionUser>, "id">;
  };
  input: TRemoveInputSchema;
};

export const removeHandler = async ({ ctx, input }: RemoveHandlerOptions) => {
  await checkPermissions({
    userId: ctx.user.id,
    teamId: input.teamId,
    allowedRoles: [MembershipRole.OWNER, MembershipRole.ADMIN],
  });

  const service = getCustomDomainService();

  return service.removeDomain({ teamId: input.teamId });
};

export default removeHandler;
