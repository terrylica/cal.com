import { notFound } from "next/navigation";

import { NEXT_PUBLIC_IS_E2E } from "@calcom/lib/public-env";
import { isENVDev } from "@calcom/lib/env";

/**
 * E2E-only page for warming up the NextAuth session.
 * This triggers the jwt and session callbacks that populate the session
 * with profile, org, and other important data.
 *
 * Only available when NEXT_PUBLIC_IS_E2E=1 is set (automatically set by playwright.config.ts)
 * or in development mode.
 */
const Page = (): JSX.Element => {
  // Gate this page to E2E test mode or dev only
  if (NEXT_PUBLIC_IS_E2E !== "1" && !isENVDev) {
    notFound();
  }

  return <div></div>;
};

export default Page;
