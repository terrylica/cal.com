/**
 * Propagates multi-tenant context through Trigger.dev tasks
 * using Trigger.dev's metadata API (not payload injection).
 *
 * - **Dispatch side**: `tenantTriggerOptions()` returns trigger options with tenantId in metadata.
 * - **Task run side**: `withTenantRun()` reads tenantId from metadata and wraps execution
 *   in `runWithTenant()`.
 */

import { getCurrentTenant, runWithTenant } from "@calcom/prisma";

import { isTenantModeEnabled, resolveTenantById } from "./tenant";

const TENANT_METADATA_KEY = "tenantId";

/**
 * Returns Trigger.dev trigger options with the current tenant in metadata.
 * Merge this into your `.trigger(payload, options)` call.
 */
export function tenantTriggerOptions(): { metadata: Record<string, string> } | undefined {
  const tenant = getCurrentTenant();
  if (!tenant) return undefined;
  return { metadata: { [TENANT_METADATA_KEY]: tenant.tenantId } };
}

/**
 * Wraps a Trigger.dev task `run` function to establish tenant context
 * by reading tenantId from Trigger.dev run metadata.
 * Passes all arguments through (payload, ctx, etc.).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function withTenantRun<TArgs extends any[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>
): (...args: TArgs) => Promise<TResult> {
  return async (...args: TArgs): Promise<TResult> => {
    if (!isTenantModeEnabled()) return fn(...args);

    const { metadata } = await import("@trigger.dev/sdk");
    const tenantId = metadata.get(TENANT_METADATA_KEY) as string | undefined;

    if (!tenantId) return fn(...args);

    const tenantInfo = resolveTenantById(tenantId);
    if (!tenantInfo) {
      console.error(
        `[multi-tenant] Trigger.dev task received tenantId="${tenantId}" but TENANT_${tenantId.toUpperCase()}_DATABASE_URL is not set.`
      );
      return fn(...args);
    }

    return runWithTenant(tenantInfo, () => fn(...args));
  };
}
