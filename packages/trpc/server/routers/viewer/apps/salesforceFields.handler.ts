import { createSalesforceCrmServiceWithSalesforceType } from "@calcom/app-store/salesforce/lib/CrmService";
import { prisma } from "@calcom/prisma";
import { credentialForCalendarServiceSelect } from "@calcom/prisma/selects/credential";
import type { TrpcSessionUser } from "@calcom/trpc/server/types";

import { TRPCError } from "@trpc/server";

import type { TSalesforceFieldsInputSchema } from "./salesforceFields.schema";

type SalesforceFieldsOptions = {
  ctx: {
    user: NonNullable<TrpcSessionUser>;
  };
  input: TSalesforceFieldsInputSchema;
};

export const salesforceFieldsHandler = async ({ ctx, input }: SalesforceFieldsOptions) => {
  const { credentialId, objectType } = input;

  const credential = await prisma.credential.findFirst({
    where: {
      id: credentialId,
      type: "salesforce_other_calendar",
      OR: [{ userId: ctx.user.id }, { team: { members: { some: { userId: ctx.user.id } } } }],
    },
    select: credentialForCalendarServiceSelect,
  });

  if (!credential) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Salesforce credential not found or you don't have access to it",
    });
  }

  const crmService = createSalesforceCrmServiceWithSalesforceType(credential);
  const fields = await crmService.getObjectFields(objectType);

  return { fields };
};
