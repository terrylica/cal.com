/**
 * Tenant context using AsyncLocalStorage.
 *
 * This module provides a way to associate a tenant with the current
 * async execution context so that the prisma Proxy in index.ts can
 * transparently route queries to the correct database.
 */
import { AsyncLocalStorage } from "node:async_hooks";

export type TenantContext = {
  tenantId: string;
  databaseUrl: string;
};

export const tenantStorage = new AsyncLocalStorage<TenantContext>();

/**
 * Runs the provided function within a tenant context.
 * All `prisma` calls inside `fn` will be routed to the tenant's database.
 */
export function runWithTenant<T>(context: TenantContext, fn: () => T): T {
  return tenantStorage.run(context, fn);
}

/**
 * Returns the current tenant context, or `undefined` if not inside
 * a `runWithTenant()` call.
 */
export function getCurrentTenant(): TenantContext | undefined {
  return tenantStorage.getStore();
}
