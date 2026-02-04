import type { GetServerSidePropsContext } from "next";
import stringify from "qs-stringify";
import type Stripe from "stripe";
import { z } from "zod";

import { getServerSession } from "@calcom/features/auth/lib/getServerSession";
import { WEBAPP_URL } from "@calcom/lib/constants";
import prisma from "@calcom/prisma";

import type { IntegrationOAuthCallbackState } from "../../../types";
import { getStripeAppKeys } from "../../lib/getStripeAppKeys";

export const getServerSideProps = async (ctx: GetServerSidePropsContext) => {
  const notFound = { notFound: true } as const;
  if (typeof ctx.params?.slug !== "string") return notFound;

  const { req } = ctx;
  const session = await getServerSession({ req });

  if (!session?.user?.id) {
    return {
      redirect: {
        destination: "/auth/login",
        permanent: false,
      },
    };
  }

  const { client_id } = await getStripeAppKeys();

  const user = await prisma.user.findUnique({
    where: {
      id: session.user.id,
    },
    select: {
      email: true,
      name: true,
    },
  });

  // Build state parameter for OAuth callback handling
  const returnTo = "/apps/installed/payment";
  const onErrorReturnTo = "/apps/installed/payment";
  const state: IntegrationOAuthCallbackState = {
    returnTo,
    onErrorReturnTo,
    fromApp: true,
  };

  const redirect_uri = encodeURI(`${WEBAPP_URL}/api/integrations/stripepayment/callback`);
  const stripeConnectParams: Stripe.OAuthAuthorizeUrlParams = {
    client_id,
    scope: "read_write",
    response_type: "code",
    stripe_user: {
      email: user?.email,
      first_name: user?.name || undefined,
      country: process.env.NEXT_PUBLIC_IS_E2E ? "US" : undefined,
    },
    redirect_uri,
    state: JSON.stringify(state),
  };

  const params = z.record(z.any()).parse(stripeConnectParams);
  const query = stringify(params);
  const targetUrl = `https://connect.stripe.com/oauth/authorize?${query}`;

  return {
    redirect: {
      destination: targetUrl,
      permanent: false,
    },
  };
};
