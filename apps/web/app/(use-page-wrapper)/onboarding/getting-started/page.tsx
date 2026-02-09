import { getServerSession } from "@calcom/features/auth/lib/getServerSession";
import { MembershipRepository } from "@calcom/features/membership/repositories/MembershipRepository";
import { APP_NAME } from "@calcom/lib/constants";
import { buildLegacyRequest } from "@lib/buildLegacyCtx";
import { _generateMetadata } from "app/_utils";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { OnboardingView } from "~/onboarding/getting-started/onboarding-view";

export const generateMetadata = async () => {
  return await _generateMetadata(
    (t) => `${APP_NAME} - ${t("getting_started")}`,
    () => "",
    true,
    undefined,
    "/onboarding/getting-started"
  );
};

const ServerPage = async () => {
  const session = await getServerSession({ req: buildLegacyRequest(await headers(), await cookies()) });

  if (!session?.user?.id) {
    return redirect("/auth/login");
  }

  // If user has any team membership (pending or accepted), check their role.
  // Invited members (MEMBER role) skip team onboarding and go directly to personal settings.
  // Team owners are redirected to the main app since they've already gone through team creation.
  const hasTeamMembership = await MembershipRepository.hasAnyTeamMembershipByUserId({ userId: session.user.id });
  if (hasTeamMembership) {
    const isTeamOwner = await MembershipRepository.hasAcceptedOwnerTeamMembership({
      userId: session.user.id,
    });
    if (isTeamOwner) {
      return redirect("/event-types");
    }
    return redirect("/onboarding/personal/settings");
  }

  const userEmail = session.user.email || "";

  return <OnboardingView userEmail={userEmail} />;
};

export default ServerPage;
