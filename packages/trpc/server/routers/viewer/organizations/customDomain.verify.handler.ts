import { CustomDomainService } from "@calcom/features/custom-domains/services/CustomDomainService";
import prisma from "@calcom/prisma";
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
    role: { in: [MembershipRole.OWNER, MembershipRole.ADMIN, MembershipRole.MEMBER] },
  });

  const service = new CustomDomainService(prisma);
  return service.verifyDomainStatus(input.teamId);
};

export default verifyHandler;
