import type { Request } from "express";

import { getEnv } from "@/env";

/**
 * Gets the list of trusted forwarded hosts from the environment variable.
 * These are hosts that are allowed to appear in the X-Forwarded-Host header
 * and will be used as the effective host instead of the Host header.
 *
 * @returns Array of trusted host strings, or empty array if not configured
 */
export function getTrustedForwardedHosts(): string[] {
  try {
    const hostsEnv = getEnv("API_TRUSTED_FORWARDED_HOSTS", "");
    if (!hostsEnv) {
      return [];
    }
    return hostsEnv
      .split(",")
      .map((host) => host.trim().toLowerCase())
      .filter((host) => host.length > 0);
  } catch {
    return [];
  }
}

/**
 * Gets the effective host for a request, preferring X-Forwarded-Host when it
 * comes from a trusted proxy.
 *
 * When requests are proxied through services like Cloudflare, the original Host
 * header may be overwritten to match the backend server. The X-Forwarded-Host
 * header preserves the original host that the client used.
 *
 * This function checks if the X-Forwarded-Host is in the list of trusted hosts
 * and returns it if so. Otherwise, it falls back to the Host header.
 *
 * @param request - The Express request object
 * @returns The effective host string to use for this request
 *
 * @example
 * // With API_TRUSTED_FORWARDED_HOSTS="api.cal.com"
 * // Request with Host: cal-api-v2.vercel.app, X-Forwarded-Host: api.cal.com
 * getEffectiveHost(request) // Returns "api.cal.com"
 *
 * // Request with Host: cal-api-v2.vercel.app, X-Forwarded-Host: malicious.com
 * getEffectiveHost(request) // Returns "cal-api-v2.vercel.app"
 */
export function getEffectiveHost(request: Request): string {
  const forwardedHost = request.headers["x-forwarded-host"];
  const host = request.headers["host"] || "";

  if (!forwardedHost) {
    return host;
  }

  // X-Forwarded-Host can be a comma-separated list if there are multiple proxies
  const primaryForwardedHost =
    typeof forwardedHost === "string" ? forwardedHost.split(",")[0].trim().toLowerCase() : forwardedHost[0].toLowerCase();

  const trustedHosts = getTrustedForwardedHosts();

  if (trustedHosts.length === 0) {
    return host;
  }

  if (trustedHosts.includes(primaryForwardedHost)) {
    return primaryForwardedHost;
  }

  return host;
}
