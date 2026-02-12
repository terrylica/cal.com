import { getSmtpConfigurationService } from "@calcom/features/di/smtpConfiguration/containers/smtpConfiguration";
import { TRPCError } from "@trpc/server";
import type { TrpcSessionUser } from "../../../types";
import type { TUpdateSmtpConfigurationInput } from "./updateSmtpConfiguration.schema";

type UpdateSmtpConfigurationOptions = {
  ctx: {
    user: NonNullable<TrpcSessionUser>;
  };
  input: TUpdateSmtpConfigurationInput;
};

function getOrganizationId(user: NonNullable<TrpcSessionUser>): number {
  const organizationId = user.profile?.organizationId || user.organizationId;
  if (!organizationId) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "You must be part of an organization to manage SMTP configurations",
    });
  }
  return organizationId;
}

export const updateSmtpConfigurationHandler = async ({ ctx, input }: UpdateSmtpConfigurationOptions) => {
  const organizationId = getOrganizationId(ctx.user);
  const service = getSmtpConfigurationService();

  return service.update(input.id, organizationId, {
    fromEmail: input.fromEmail,
    fromName: input.fromName,
    smtpHost: input.smtpHost,
    smtpPort: input.smtpPort,
    smtpUser: input.smtpUser,
    smtpPassword: input.smtpPassword,
    smtpSecure: input.smtpSecure,
  });
};

export default updateSmtpConfigurationHandler;
