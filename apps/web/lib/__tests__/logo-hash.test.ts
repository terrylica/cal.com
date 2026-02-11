import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { LogoType } from "../logo-hash";
import { getLogoHash, getLogoUrl, isValidLogoType } from "../logo-hash";

const LOGO_TYPES: LogoType[] = [
  "logo",
  "icon",
  "favicon-16",
  "favicon-32",
  "apple-touch-icon",
  "mstile",
  "android-chrome-192",
  "android-chrome-256",
];

describe("isValidLogoType", () => {
  it.each(LOGO_TYPES)("returns true for valid type '%s'", (type) => {
    expect(isValidLogoType(type)).toBe(true);
  });

  it("returns false for invalid type", () => {
    expect(isValidLogoType("nonexistent")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isValidLogoType("")).toBe(false);
  });
});

describe("getLogoHash", () => {
  it.each(LOGO_TYPES)("returns a non-empty 8-char hex hash for '%s'", (type) => {
    const hash = getLogoHash(type);
    expect(hash).toMatch(/^[a-f0-9]{8}$/);
  });

  it("returns consistent hash for the same type", () => {
    const hash1 = getLogoHash("logo");
    const hash2 = getLogoHash("logo");
    expect(hash1).toBe(hash2);
  });

  it("matches sha256 of the actual file content", () => {
    const filePath = path.resolve(__dirname, "..", "..", "public", "favicon-32x32.png");
    const content = readFileSync(filePath);
    const expected = createHash("sha256").update(content).digest("hex").slice(0, 8);
    expect(getLogoHash("favicon-32")).toBe(expected);
  });
});

describe("getLogoUrl", () => {
  it("includes the type and hash in the URL", () => {
    const url = getLogoUrl("favicon-32");
    const hash = getLogoHash("favicon-32");
    expect(url).toBe(`/api/logo?type=favicon-32&v=${hash}`);
  });

  it.each(LOGO_TYPES)("returns a URL with v= param for '%s'", (type) => {
    const url = getLogoUrl(type);
    expect(url).toContain(`type=${type}`);
    expect(url).toMatch(/&v=[a-f0-9]{8}$/);
  });
});
