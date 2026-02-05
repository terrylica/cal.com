import { useEffect, useState } from "react";

import { getOrgFullOrigin } from "@calcom/ee/organizations/lib/orgDomains";
import { getUserAvatarUrl } from "@calcom/lib/getAvatarUrl";
import type { User } from "@calcom/prisma/client";
import type { UserProfile } from "@calcom/types/UserProfile";

import { AvatarGroup } from "./AvatarGroup";

type UserAvatarProps = Omit<React.ComponentProps<typeof AvatarGroup>, "items"> & {
  users: (Pick<User, "name" | "username" | "avatarUrl"> & {
    profile: Omit<UserProfile, "upId">;
  })[];
};

type AvatarItem = {
  href: string | null;
  alt: string;
  title: string;
  image: string;
};

export function UserAvatarGroup(props: UserAvatarProps) {
  const { users, ...rest } = props;

  const [items, setItems] = useState<AvatarItem[]>(
    users.map((user) => ({
      href: null,
      alt: user.name || "",
      title: user.name || "",
      image: getUserAvatarUrl(user),
    }))
  );

  useEffect(() => {
    setItems(
      users.map((user) => {
        const org = user.profile?.organization;
        const customDomain = org?.customDomain?.verified ? org.customDomain.slug : null;
        const baseUrl = getOrgFullOrigin(customDomain ?? org?.slug ?? null, {
          protocol: true,
          isCustomDomain: !!customDomain,
        });
        return {
          href: `${baseUrl}/${user.profile?.username}?redirect=false`,
          alt: user.name || "",
          title: user.name || "",
          image: getUserAvatarUrl(user),
        };
      })
    );
  }, [users]);

  return <AvatarGroup {...rest} items={items} />;
}
