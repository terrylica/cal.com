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

export function createDatabaseProxy(config: ProxyConfig): DatabaseProxy {
  const { primary, replicas, tenants } = config;

  return new Proxy(primary, {
    get(_, prop) {
      if (prop === "replica") {
        return (name?: string | null) => (name ? replicas.get(name) : undefined) ?? primary;
      }

      if (prop === "tenant") {
        return (name?: string) => {
          const tenantCfg = name && tenants.get(name);
          return tenantCfg
            ? createDatabaseProxy({ ...tenantCfg, tenants })
            : createDatabaseProxy(config);
        };
      }

      return primary[prop as keyof PrismaClient];
    },
  }) as DatabaseProxy;
}
