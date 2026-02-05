# DatabaseProxy

Prisma wrapper with read replica and multi-tenant support.

## Quick Start

```typescript
import { prisma } from "@calcom/prisma";

// Primary database (default)
await prisma.user.findMany();

// Read replica
await prisma.replica("read").user.findMany();

// Tenant database
await prisma.tenant("acme").user.findMany();

// Tenant + replica
await prisma.tenant("acme").replica("read").user.findMany();
```

## Configuration

```bash
# Primary (required)
DATABASE_URL="postgresql://user:pass@primary:5432/calcom"

# Replicas (optional)
DATABASE_READ_REPLICAS='{"read":"postgresql://...","analytics":"postgresql://..."}'

# Tenants (optional)
DATABASE_TENANTS='{"acme":"postgresql://...","globex":"postgresql://..."}'
```

### Tenant with replicas

```bash
DATABASE_TENANTS='{
  "acme": {
    "primary": "postgresql://acme-primary/db",
    "replicas": { "read": "postgresql://acme-replica/db" }
  }
}'
```

## API

| Method | Description | Fallback |
|--------|-------------|----------|
| `prisma.replica(name)` | Route to read replica | Primary if not found |
| `prisma.tenant(name)` | Route to tenant database | Primary if not found |
| `prisma.tenant(name).replica(name)` | Tenant-specific replica | Tenant primary |

## Examples

### Read replicas for heavy queries

```typescript
// Expensive read → replica
const bookings = await prisma.replica("read").booking.findMany({
  where: { createdAt: { gte: lastMonth } },
  include: { attendees: true, eventType: true },
});

// Writes → primary (always)
await prisma.booking.create({ data: { ... } });
```

### Multi-tenancy

```typescript
// Get tenant-scoped database
const acme = prisma.tenant("acme");

await acme.user.findMany();
await acme.booking.findMany();
await acme.eventType.findMany();
```

### Request-based routing (Next.js)

```typescript
// Route based on header
import { headers } from "next/headers";
import { prisma } from "@calcom/prisma";

export async function GET() {
  const h = await headers();
  const db = prisma.replica(h.get("x-cal-replica"));

  return Response.json(await db.user.findMany());
}
```

### Domain-based tenant routing

```typescript
const TENANTS: Record<string, string> = {
  "acme.cal.com": "acme",
  "globex.cal.com": "globex",
};

function getDb(host: string) {
  return prisma.tenant(TENANTS[host]);
}
```

## Fallback Behavior

All methods gracefully fallback to primary when target doesn't exist:

```typescript
prisma.replica("nonexistent")     // → primary
prisma.replica(null)              // → primary
prisma.replica("")                // → primary
prisma.tenant("nonexistent")      // → primary
prisma.tenant(undefined)          // → primary
prisma.tenant("x").replica("y")   // → tenant primary (if replica missing)
```

## Type Safety

Full TypeScript support with autocomplete:

```typescript
const user = await prisma.replica("read").user.findFirst({
  where: { email: "test@example.com" },
  select: { id: true, name: true },
});
// user: { id: number; name: string | null } | null
```

## Troubleshooting

**Replica not used?** Check JSON syntax:
```bash
# ✓ Correct
DATABASE_READ_REPLICAS='{"read":"postgresql://..."}'

# ✗ Wrong
DATABASE_READ_REPLICAS={read:"postgresql://..."}
```

**Tenant not found?** Names are case-sensitive:
```typescript
prisma.tenant("acme")  // ✓
prisma.tenant("ACME")  // ✗ falls back to primary
```
