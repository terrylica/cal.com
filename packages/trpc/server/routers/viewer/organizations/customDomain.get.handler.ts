import { CustomDomainService } from "@calcom/features/custom-domains/services/CustomDomainService";
import prisma from "@calcom/prisma";
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
    role: { in: [MembershipRole.OWNER, MembershipRole.ADMIN, MembershipRole.MEMBER] },
  });

  const service = new CustomDomainService(prisma);
  const domain = await service.getDomain(input.teamId);

  return domain;
};

export default getHandler;
