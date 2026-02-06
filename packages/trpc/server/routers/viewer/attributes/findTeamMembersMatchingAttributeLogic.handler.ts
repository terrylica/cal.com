import type { ServerResponse } from "node:http";
import type { NextApiResponse } from "next";

import { findTeamMembersMatchingAttributeLogic } from "@calcom/features/routing-forms/lib/findTeamMembersMatchingAttributeLogic";
import { UserRepository } from "@calcom/features/users/repositories/UserRepository";
import type { PrismaClient } from "@calcom/prisma";
import type { TrpcSessionUser } from "@calcom/trpc/server/types";

import type { TFindTeamMembersMatchingAttributeLogicInputSchema } from "./findTeamMembersMatchingAttributeLogic.schema";

interface FindTeamMembersMatchingAttributeLogicHandlerOptions {
  ctx: {
    prisma: PrismaClient;
    user: NonNullable<TrpcSessionUser>;
    res: ServerResponse | NextApiResponse | undefined;
  };
  input: TFindTeamMembersMatchingAttributeLogicInputSchema;
}

export const findTeamMembersMatchingAttributeLogicHandler = async ({
  ctx,
  input,
}: FindTeamMembersMatchingAttributeLogicHandlerOptions) => {
  const { teamId, attributesQueryValue, _enablePerf, _concurrency, cursor, limit } = input;
  const orgId = ctx.user.organizationId;
  if (!orgId) {
    throw new Error("You must be in an organization to use this feature");
  }
  const {
    teamMembersMatchingAttributeLogic: matchingTeamMembersWithResult,
    mainAttributeLogicBuildingWarnings: mainWarnings,
    fallbackAttributeLogicBuildingWarnings: fallbackWarnings,
    troubleshooter,
  } = await findTeamMembersMatchingAttributeLogic(
    {
      teamId,
      attributesQueryValue,
      orgId,
    },
    {
      enablePerf: _enablePerf,
      enableTroubleshooter: _enablePerf,
      concurrency: _concurrency,
    }
  );

  if (!matchingTeamMembersWithResult) {
    return {
      troubleshooter,
      mainWarnings,
      fallbackWarnings,
      result: null,
      nextCursor: undefined,
      total: 0,
    };
  }

  const matchingTeamMembersIds = matchingTeamMembersWithResult.map((member) => member.userId);
  const matchingTeamMembers = await new UserRepository(ctx.prisma).findByIds({ ids: matchingTeamMembersIds });

  const sortedMembers = matchingTeamMembers
    .map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
    }))
    .sort((a, b) => a.id - b.id);

  // When limit is not provided, return all results (backward compatible)
  if (!limit) {
    return {
      mainWarnings,
      fallbackWarnings,
      troubleshooter,
      result: sortedMembers,
      nextCursor: undefined,
      total: sortedMembers.length,
    };
  }

  // Paginate using cursor-based keyset pagination on user ID
  const startIndex = cursor ? sortedMembers.findIndex((m) => m.id > cursor) : 0;
  const page = startIndex >= 0 ? sortedMembers.slice(startIndex, startIndex + limit) : [];
  const nextCursor = page.length === limit ? page[page.length - 1].id : undefined;

  return {
    mainWarnings,
    fallbackWarnings,
    troubleshooter,
    result: page,
    nextCursor,
    total: sortedMembers.length,
  };
};

export default findTeamMembersMatchingAttributeLogicHandler;
