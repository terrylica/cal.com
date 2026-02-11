import path from "node:path";
import { APP_STORE_PATH } from "../constants";

export function getAppName(candidatePath) {
  function isValidAppName(candidatePath) {
    if (
      !candidatePath.startsWith("_") &&
      candidatePath !== "ee" &&
      candidatePath !== "apps" &&
      !candidatePath.includes("/") &&
      !candidatePath.includes("\\")
    ) {
      return candidatePath;
    }
  }
  if (isValidAppName(candidatePath)) {
    return candidatePath;
  }
  const dirName = path.relative(APP_STORE_PATH, candidatePath);
  if (isValidAppName(dirName)) return dirName;
  // Handle apps/ subdirectory paths from chokidar watch mode
  const appsPrefix = `apps${path.sep}`;
  if (dirName.startsWith(appsPrefix) || dirName.startsWith("apps/")) {
    const appName = dirName.replace(/^apps[/\\]/, "").split(/[\\/]/)[0];
    return isValidAppName(appName) ? appName : null;
  }
  return null;
}
