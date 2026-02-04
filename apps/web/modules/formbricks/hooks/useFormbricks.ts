import formbricks from "@formbricks/js/app";
import { useSession } from "next-auth/react";
import { useEffect } from "react";

import { isENVDev } from "@calcom/lib/env";
import {
  NEXT_PUBLIC_FORMBRICKS_HOST_URL,
  NEXT_PUBLIC_FORMBRICKS_ENVIRONMENT_ID,
} from "@calcom/lib/public-env";
import useMeQuery from "@calcom/trpc/react/hooks/useMeQuery";

const initFormbricks = ({
  userId,
  attributes,
}: {
  userId: string;
  attributes: { [key: string]: string | null | undefined };
}) => {
  const filteredAttributes: Record<string, string | number> = {};
  Object.entries(attributes).forEach(([key, value]) => {
    if (value !== null && value !== undefined) {
      filteredAttributes[key] = value;
    }
  });

  if (NEXT_PUBLIC_FORMBRICKS_HOST_URL && NEXT_PUBLIC_FORMBRICKS_ENVIRONMENT_ID) {
    formbricks.init({
      environmentId: NEXT_PUBLIC_FORMBRICKS_ENVIRONMENT_ID,
      apiHost: NEXT_PUBLIC_FORMBRICKS_HOST_URL,
      debug: isENVDev,
      userId,
      attributes: filteredAttributes,
    });
  }
};

export const useFormbricks = () => {
  const { data: user, isLoading } = useMeQuery();
  const { data: session, status } = useSession();

  useEffect(() => {
    if (!isLoading && user && session) {
      initFormbricks({
        userId: user.id.toString(),
        attributes: {
          name: user?.name,
          email: user.email,
          username: user?.username,
          belongsToActiveTeam: session.user.belongsToActiveTeam?.toString(),
          isOrganizationAdmin: user.organization?.isOrgAdmin?.toString(),
        },
      });
    }
  }, [isLoading, user, status, session]);
};
