import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  ANDROID_CHROME_ICON_192,
  ANDROID_CHROME_ICON_256,
  APPLE_TOUCH_ICON,
  FAVICON_16,
  FAVICON_32,
  LOGO,
  LOGO_ICON,
  MSTILE_ICON,
} from "@calcom/lib/constants";

type LogoType =
  | "logo"
  | "icon"
  | "favicon-16"
  | "favicon-32"
  | "apple-touch-icon"
  | "mstile"
  | "android-chrome-192"
  | "android-chrome-256";

const logoFileMap: Record<LogoType, string> = {
  logo: LOGO,
  icon: LOGO_ICON,
  "favicon-16": FAVICON_16,
  "favicon-32": FAVICON_32,
  "apple-touch-icon": APPLE_TOUCH_ICON,
  mstile: MSTILE_ICON,
  "android-chrome-192": ANDROID_CHROME_ICON_192,
  "android-chrome-256": ANDROID_CHROME_ICON_256,
};

const hashCache: Map<string, string> = new Map<string, string>();

let resolvedPublicDir: string | null | undefined;

function findPublicDir(): string | null {
  if (resolvedPublicDir !== undefined) return resolvedPublicDir;

  const candidates = [
    path.join(process.cwd(), "public"),
    path.join(process.cwd(), "apps", "web", "public"),
  ];

  for (const candidate of candidates) {
    if (existsSync(path.join(candidate, "favicon-32x32.png"))) {
      resolvedPublicDir = candidate;
      return candidate;
    }
  }

  resolvedPublicDir = null;
  return null;
}

function isValidLogoType(type: string): type is LogoType {
  return type in logoFileMap;
}

function getLogoHash(type: LogoType): string {
  const cached = hashCache.get(type);
  if (cached) return cached;

  const filePath = logoFileMap[type];
  if (!filePath) return "";

  try {
    const publicDir = findPublicDir();
    if (!publicDir) return "";
    const fullPath = path.join(publicDir, filePath);
    const content = readFileSync(fullPath);
    const hash = createHash("sha256").update(content).digest("hex").slice(0, 8);
    hashCache.set(type, hash);
    return hash;
  } catch {
    return "";
  }
}

function getLogoUrl(type: LogoType): string {
  const hash = getLogoHash(type);
  if (hash) {
    return `/api/logo?type=${type}&v=${hash}`;
  }
  return `/api/logo?type=${type}`;
}

export { getLogoHash, getLogoUrl, isValidLogoType };
export type { LogoType };
