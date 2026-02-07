import { beforeEach, describe, expect, it, vi } from "vitest";

import { i18nHandler } from "./i18n.handler";

const mockServerSideTranslations = vi.fn().mockResolvedValue({
  _nextI18Next: {
    initialI18nStore: { en: { common: {} } },
    initialLocale: "en",
    ns: ["common", "vital"],
  },
});

vi.mock("next-i18next/serverSideTranslations", () => ({
  serverSideTranslations: mockServerSideTranslations,
}));

describe("i18n handler", () => {
  beforeEach(() => {
    mockServerSideTranslations.mockClear();
  });

  describe("passing config directly bypasses file system lookup", () => {
    it("passes config as third argument to serverSideTranslations", async () => {
      await i18nHandler({ input: { locale: "en", CalComVersion: "1.0" } });

      expect(mockServerSideTranslations).toHaveBeenCalledOnce();

      const [locale, namespaces, config] = mockServerSideTranslations.mock.calls[0];
      expect(locale).toBe("en");
      expect(namespaces).toEqual(["common", "vital"]);
      expect(config).toBeDefined();
      expect(config).not.toBeNull();
    });

    it("passed config includes i18n settings from @calcom/config", async () => {
      await i18nHandler({ input: { locale: "en", CalComVersion: "1.0" } });

      const config = mockServerSideTranslations.mock.calls[0][2];
      expect(config.i18n).toBeDefined();
      expect(config.i18n.defaultLocale).toBe("en");
      expect(Array.isArray(config.i18n.locales)).toBe(true);
      expect(config.i18n.locales).toContain("en");
    });

    it("passed config includes localePath pointing to public/static/locales", async () => {
      await i18nHandler({ input: { locale: "en", CalComVersion: "1.0" } });

      const config = mockServerSideTranslations.mock.calls[0][2];
      expect(config.localePath).toBeDefined();
      expect(config.localePath).toContain("public/static/locales");
    });

    it("does not throw when config is passed directly", async () => {
      const result = await i18nHandler({ input: { locale: "en", CalComVersion: "1.0" } });
      expect(result.locale).toBe("en");
      expect(result.i18n).toBeDefined();
    });
  });
});
