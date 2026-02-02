import { CustomDomainService } from "@calcom/features/custom-domains/services/CustomDomainService";
import prisma from "@calcom/prisma";
import { MembershipRole } from "@calcom/prisma/enums";
import { TRPCError } from "@trpc/server";

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
    role: { in: [MembershipRole.OWNER, MembershipRole.ADMIN] },
  });

  const service = new CustomDomainService(prisma);

  try {
    const domain = await service.addDomain({
      teamId: input.teamId,
      slug: input.slug,
    });

    return domain;
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Invalid domain format") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid domain format",
        });
      }
      if (error.message === "Team already has a custom domain configured") {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Team already has a custom domain configured",
        });
      }
      if (error.message === "Domain is already in use") {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Domain is already in use by another team",
        });
      }
    }
    throw error;
  }
};

export default addHandler;
