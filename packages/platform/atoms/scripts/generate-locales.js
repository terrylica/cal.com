import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../../../..");
const ATOMS_DIR = path.resolve(__dirname, "..");
const OUTPUT_DIR = path.resolve(__dirname, "../cal-provider/locales");

const SCAN_DIRS = [
  ATOMS_DIR,
  path.join(REPO_ROOT, "packages/features"),
  path.join(REPO_ROOT, "packages/ui"),
  path.join(REPO_ROOT, "packages/lib"),
];

const LANGUAGES = ["en", "de", "es", "fr", "it", "nl", "pt-BR"];
const SKIP_DIRS = ["node_modules", "__tests__", ".turbo", "dist"];
const T_CALL_RE = /\bt\(\s*["']([a-zA-Z_][a-zA-Z0-9_]*)["']/g;

function extractKeysFromFile(filePath) {
  const keys = new Set();
  const content = fs.readFileSync(filePath, "utf-8");
  let match;
  while ((match = T_CALL_RE.exec(content)) !== null) {
    keys.add(match[1]);
  }
  T_CALL_RE.lastIndex = 0;
  return keys;
}

function scanDirectory(dirPath, keys) {
  if (!fs.existsSync(dirPath)) return;
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    if (SKIP_DIRS.includes(entry.name)) continue;
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      scanDirectory(fullPath, keys);
    } else if (/\.(tsx?|jsx?)$/.test(entry.name) && !/\.(test|spec|stories)\.(tsx?|jsx?)$/.test(entry.name)) {
      for (const key of extractKeysFromFile(fullPath)) {
        keys.add(key);
      }
    }
  }
}

const keys = new Set();
for (const dir of SCAN_DIRS) {
  scanDirectory(dir, keys);
}

const enPath = path.join(REPO_ROOT, "apps/web/public/static/locales/en/common.json");
const enTranslations = JSON.parse(fs.readFileSync(enPath, "utf-8"));

const validKeys = new Set();
for (const key of keys) {
  if (key in enTranslations) {
    validKeys.add(key);
    for (const suffix of ["_one", "_other", "_zero", "_two", "_few", "_many"]) {
      const pluralKey = key + suffix;
      if (pluralKey in enTranslations) {
        validKeys.add(pluralKey);
      }
    }
  }
}

for (const key of [...validKeys]) {
  const base = key.includes("_") ? key.replace(/_(?:one|other|zero|two|few|many)$/, "") : key;
  if (base !== key && base in enTranslations) {
    validKeys.add(base);
  }
  for (const suffix of ["_one", "_other", "_zero", "_two", "_few", "_many"]) {
    const pluralKey = base + suffix;
    if (pluralKey in enTranslations) {
      validKeys.add(pluralKey);
    }
  }
}

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

const sortedKeys = [...validKeys].sort();

for (const lang of LANGUAGES) {
  const fullPath = path.join(REPO_ROOT, `apps/web/public/static/locales/${lang}/common.json`);
  const fullTranslations = JSON.parse(fs.readFileSync(fullPath, "utf-8"));

  const subset = {};
  for (const key of sortedKeys) {
    if (key in fullTranslations) {
      subset[key] = fullTranslations[key];
    }
  }

  const outPath = path.join(OUTPUT_DIR, `${lang}.json`);
  fs.writeFileSync(outPath, JSON.stringify(subset, null, 2) + "\n");

  const fullSize = fs.statSync(fullPath).size;
  const subsetSize = Buffer.byteLength(JSON.stringify(subset, null, 2) + "\n");
  console.log(`${lang}: ${Object.keys(subset).length} keys, ${(subsetSize / 1024).toFixed(0)} KB (was ${(fullSize / 1024).toFixed(0)} KB, -${((1 - subsetSize / fullSize) * 100).toFixed(0)}%)`);
}

console.log(`\nGenerated ${LANGUAGES.length} locale files in ${path.relative(REPO_ROOT, OUTPUT_DIR)}/`);
