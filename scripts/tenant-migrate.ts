#!/usr/bin/env npx ts-node
import process from "node:process";
/**
 * Multi-tenant migration script.
 *
 * Reads TENANT_DOMAINS from environment variables and runs
 * `prisma migrate deploy` against each tenant's database.
 *
 * Usage:
 *   npx ts-node scripts/tenant-migrate.ts
 *
 * Environment:
 *   TENANT_DOMAINS='{"scheduling.acme.com":"acme","agenda.sales.com":"sales"}'
 *   TENANT_ACME_DATABASE_URL="postgresql://..."
 *   TENANT_SALES_DATABASE_URL="postgresql://..."
 */
import { execSync } from "child_process";
import path from "path";

interface MigrationResult {
  tenantId: string;
  success: boolean;
  error?: string;
}

function main(): void {
  const raw = process.env.TENANT_DOMAINS;
  if (!raw) {
    console.log("[tenant-migrate] TENANT_DOMAINS not set. Nothing to migrate.");
    process.exit(0);
  }

  let domainMap: Record<string, string>;
  try {
    domainMap = JSON.parse(raw);
  } catch (err) {
    console.error("[tenant-migrate] Failed to parse TENANT_DOMAINS:", err);
    process.exit(1);
  }

  // Deduplicate tenant IDs (multiple domains can point to the same tenant)
  const tenantIds = [...new Set(Object.values(domainMap))];

  if (tenantIds.length === 0) {
    console.log("[tenant-migrate] No tenants configured. Nothing to migrate.");
    process.exit(0);
  }

  console.log(`[tenant-migrate] Found ${tenantIds.length} tenant(s): ${tenantIds.join(", ")}`);

  const prismaDir = path.resolve(__dirname, "../packages/prisma");
  const results: MigrationResult[] = [];

  for (const tenantId of tenantIds) {
    const envKey = `TENANT_${tenantId.toUpperCase()}_DATABASE_URL`;
    const databaseUrl = process.env[envKey];

    if (!databaseUrl) {
      const result: MigrationResult = {
        tenantId,
        success: false,
        error: `Environment variable ${envKey} is not set`,
      };
      results.push(result);
      console.error(`[tenant-migrate] [${tenantId}] SKIPPED: ${result.error}`);
      continue;
    }

    console.log(`[tenant-migrate] [${tenantId}] Running prisma migrate deploy...`);

    try {
      execSync("npx prisma migrate deploy", {
        cwd: prismaDir,
        env: {
          ...process.env,
          DATABASE_URL: databaseUrl,
        },
        stdio: "inherit",
      });
      results.push({ tenantId, success: true });
      console.log(`[tenant-migrate] [${tenantId}] Migration completed successfully.`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      results.push({ tenantId, success: false, error: errorMessage });
      console.error(`[tenant-migrate] [${tenantId}] Migration FAILED: ${errorMessage}`);
    }
  }

  // Summary
  console.log("\n[tenant-migrate] === Migration Summary ===");
  const succeeded = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);

  for (const r of succeeded) {
    console.log(`  ✓ ${r.tenantId}`);
  }
  for (const r of failed) {
    console.log(`  ✗ ${r.tenantId}: ${r.error}`);
  }

  console.log(`\n  Total: ${results.length} | Succeeded: ${succeeded.length} | Failed: ${failed.length}`);

  if (failed.length > 0) {
    process.exit(1);
  }
}

main();
