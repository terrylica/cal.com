import { Resource } from "@calcom/features/pbac/domain/types/permission-registry";
import { getResourcePermissions } from "@calcom/features/pbac/lib/resource-permissions";
import SettingsHeader from "@calcom/features/settings/appDir/SettingsHeader";
import { MembershipRole } from "@calcom/prisma/enums";
import { _generateMetadata, getTranslate } from "app/_utils";
import { redirect } from "next/navigation";
import SmtpConfigurationsView from "~/ee/organizations/smtp-configuration/SmtpConfigurationsView";
import { validateUserHasOrg } from "../../actions/validateUserHasOrg";

export const generateMetadata = async () =>
  await _generateMetadata(
    (t) => t("smtp_configuration"),
    (t) => t("smtp_configuration_description"),
    undefined,
    undefined,
    "/settings/organizations/smtp-configuration"
  );

const Page = async () => {
  const session = await validateUserHasOrg();
  const t = await getTranslate();

  if (!session?.user.id || !session?.user.profile?.organizationId || !session?.user.org) {
    redirect("/settings/profile");
  }

  const { canRead, canEdit } = await getResourcePermissions({
    userId: session.user.id,
    teamId: session.user.profile.organizationId,
    resource: Resource.Organization,
    userRole: session.user.org.role,
    fallbackRoles: {
      read: {
        roles: [MembershipRole.ADMIN, MembershipRole.OWNER],
      },
      update: {
        roles: [MembershipRole.ADMIN, MembershipRole.OWNER],
      },
    },
  });

  if (!canRead) {
    redirect("/settings/organizations/profile");
  }

  return (
    <SettingsHeader
      title={t("smtp_configuration")}
      description={t("smtp_configuration_description")}>
      <SmtpConfigurationsView permissions={{ canRead, canEdit }} />
    </SettingsHeader>
  );
};

export default Page;
