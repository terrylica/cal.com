import { CustomDomainService } from "@calcom/features/custom-domains/services/CustomDomainService";
import prisma from "@calcom/prisma";
import { MembershipRole } from "@calcom/prisma/enums";
import { TRPCError } from "@trpc/server";

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
    role: { in: [MembershipRole.OWNER, MembershipRole.ADMIN] },
  });

  const service = new CustomDomainService(prisma);

  try {
    return await service.removeDomain({ teamId: input.teamId });
  } catch (error) {
    if (error instanceof Error && error.message === "No custom domain found for this team") {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "No custom domain found for this team",
      });
    }
    throw error;
  }
};

export default removeHandler;
