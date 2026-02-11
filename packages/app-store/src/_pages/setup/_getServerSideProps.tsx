import type { GetServerSidePropsContext } from "next";

export const AppSetupPageMap = {
  alby: import("../../../apps/alby/src/pages/setup/_getServerSideProps"),
  make: import("../../../apps/make/src/pages/setup/_getServerSideProps"),
  stripe: import("../../../apps/stripepayment/src/pages/setup/_getServerSideProps"),
  hitpay: import("../../../apps/hitpay/src/pages/setup/_getServerSideProps"),
  btcpayserver: import("../../../apps/btcpayserver/src/pages/setup/_getServerSideProps"),
};

export const getServerSideProps = async (ctx: GetServerSidePropsContext) => {
  const { slug } = ctx.params || {};
  if (typeof slug !== "string") return { notFound: true } as const;

  if (!(slug in AppSetupPageMap)) return { props: {} };

  const page = await AppSetupPageMap[slug as keyof typeof AppSetupPageMap];

  if (!page.getServerSideProps) return { props: {} };

  const props = await page.getServerSideProps(ctx);

  return props;
};
