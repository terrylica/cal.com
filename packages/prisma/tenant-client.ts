/**
 * Cache of PrismaClient instances per tenant.
 *
 * Each tenant gets its own connection pool and PrismaClient with all
 * standard extensions applied (via `customPrisma()`).
 */

import process from "node:process";
import { Pool } from "pg";
import type { PrismaClient } from "./generated/prisma/client";
import { customPrisma } from "./index";

const clientCache = new Map<string, PrismaClient>();

/**
 * Returns a cached PrismaClient for the given tenant.
 * Creates one on first access.
 */
export function getTenantPrismaClient(tenantId: string, databaseUrl: string): PrismaClient {
  const existing = clientCache.get(tenantId);
  if (existing) return existing;

  const poolMax = parseInt(process.env.TENANT_POOL_MAX || "5", 10);
  const tenantPool = new Pool({
    connectionString: databaseUrl,
    max: poolMax,
    idleTimeoutMillis: 300_000,
  });

  const client = customPrisma({ datasources: { db: { url: databaseUrl } } }, tenantPool);
  clientCache.set(tenantId, client);
  return client;
}
