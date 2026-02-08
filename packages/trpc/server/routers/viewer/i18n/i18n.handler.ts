import path from "node:path";
import type { I18nInputSchema } from "./i18n.schema";
import i18nConfig from "@calcom/config/next-i18next.config";
import type { UserConfig } from "next-i18next";

type I18nOptions = {
  input: I18nInputSchema;
};

export const i18nHandler = async ({ input }: I18nOptions) => {
  const { locale } = input;
  const { serverSideTranslations } = await import("next-i18next/serverSideTranslations");
  const config: UserConfig = {
    ...i18nConfig,
    localePath: path.resolve("./public/static/locales"),
  };
  const i18n = await serverSideTranslations(locale, ["common", "vital"], config);

  return {
    i18n,
    locale,
  };
};

export default i18nHandler;
