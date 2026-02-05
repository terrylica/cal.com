import { metrics } from "@sentry/nextjs";

import type { PrismaClient } from "./generated/prisma/client";

export type DatabaseProxy = PrismaClient & {
  replica: (name?: string | null) => PrismaClient;
  tenant: (name?: string | null) => DatabaseProxy;
};

export type TenantConfig = {
  primary: PrismaClient;
  replicas: Map<string, PrismaClient>;
};

export type ProxyConfig = TenantConfig & {
  tenants: Map<string, TenantConfig>;
};

export type ProxyContext = {
  tenant?: string;
};

export function createDatabaseProxy(config: ProxyConfig, context: ProxyContext = {}): DatabaseProxy {
  const { primary, replicas, tenants } = config;

  return new Proxy(primary, {
    get(_, prop) {
      if (prop === "replica") {
        return (name?: string | null) => {
          const replica = name ? replicas.get(name) : undefined;
          const usedReplica = replica ?? primary;
          const isFallback = name && !replica;

          metrics.count("database.replica.calls", 1, {
            attributes: {
              replica: name ?? "none",
              fallback: isFallback ? "true" : "false",
              tenant: context.tenant ?? "default",
            },
          });

          return usedReplica;
        };
      }

      if (prop === "tenant") {
        return (name?: string) => {
          const tenantCfg = name ? tenants.get(name) : undefined;
          const isFallback = name && !tenantCfg;

          metrics.count("database.tenant.calls", 1, {
            attributes: {
              tenant: name ?? "none",
              fallback: isFallback ? "true" : "false",
            },
          });

          return tenantCfg
            ? createDatabaseProxy({ ...tenantCfg, tenants }, { tenant: name })
            : createDatabaseProxy(config, context);
        };
      }

      return primary[prop as keyof PrismaClient];
    },
  }) as DatabaseProxy;
}
