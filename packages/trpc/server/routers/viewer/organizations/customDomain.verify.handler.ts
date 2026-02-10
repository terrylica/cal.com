import { getCustomDomainService } from "@calcom/features/custom-domains/di/CustomDomainService.container";
import { MembershipRole } from "@calcom/prisma/enums";

import type { TrpcSessionUser } from "../../../types";
import { checkPermissions } from "./customDomain._auth-middleware";
import type { TVerifyInputSchema } from "./customDomain.verify.schema";

type VerifyHandlerOptions = {
  ctx: {
    user: Pick<NonNullable<TrpcSessionUser>, "id">;
  };
  input: TVerifyInputSchema;
};

export const verifyHandler = async ({ ctx, input }: VerifyHandlerOptions) => {
  await checkPermissions({
    userId: ctx.user.id,
    teamId: input.teamId,
    allowedRoles: [MembershipRole.OWNER, MembershipRole.ADMIN, MembershipRole.MEMBER],
  });

  const service = getCustomDomainService();

  return service.verifyDomainStatus(input.teamId);
};

export default verifyHandler;
