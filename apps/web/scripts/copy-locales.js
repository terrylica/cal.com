const fs = require("node:fs");
const path = require("node:path");

const copyLocales = () => {
  const sourceDir = path.resolve(__dirname, "../../../packages/config/i18n/locales");
  const destDir = path.resolve(__dirname, "../public/static/locales");

  // Remove existing destination directory if it exists
  if (fs.existsSync(destDir)) {
    fs.rmSync(destDir, { recursive: true });
  }

  // Create destination directory
  fs.mkdirSync(destDir, { recursive: true });

  // Copy all locale directories
  const locales = fs.readdirSync(sourceDir);

  locales.forEach((locale) => {
    const sourcePath = path.join(sourceDir, locale);
    const destPath = path.join(destDir, locale);

    // Skip if not a directory
    if (!fs.statSync(sourcePath).isDirectory()) {
      return;
    }

    // Create locale directory
    fs.mkdirSync(destPath, { recursive: true });

    // Copy all JSON files in the locale directory
    const files = fs.readdirSync(sourcePath);
    files.forEach((file) => {
      if (file.endsWith(".json")) {
        const sourceFile = path.join(sourcePath, file);
        const destFile = path.join(destPath, file);
        fs.copyFileSync(sourceFile, destFile);
        console.log(`Copied ${locale}/${file}`);
      }
    });
  });

  console.log("Locale files copied successfully!");
};

// Run the copy function
copyLocales();
