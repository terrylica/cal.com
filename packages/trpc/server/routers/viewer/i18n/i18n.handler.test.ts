import path from "node:path";

import { describe, expect, it } from "vitest";

import i18nConfig from "@calcom/config/next-i18next.config";

describe("i18n handler", () => {
  it("serverSideTranslations throws without config because next-i18next.config.js no longer exists", async () => {
    const { serverSideTranslations } = await import("next-i18next/serverSideTranslations");

    await expect(serverSideTranslations("en", ["common"])).rejects.toThrow(
      /next-i18next was unable to find a user config/
    );
  });

  it("serverSideTranslations succeeds when config is passed directly", async () => {
    const { serverSideTranslations } = await import("next-i18next/serverSideTranslations");

    const result = await serverSideTranslations("en", ["common", "vital"], {
      ...i18nConfig,
      localePath: path.resolve("./public/static/locales"),
    });

    expect(result._nextI18Next).toBeDefined();
    expect(result._nextI18Next.initialLocale).toBe("en");
    expect(result._nextI18Next.ns).toContain("common");
    expect(result._nextI18Next.ns).toContain("vital");
  });
});
