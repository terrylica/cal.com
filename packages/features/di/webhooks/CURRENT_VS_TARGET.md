# Webhooks: Current vs Target Implementation

**Visual guide showing exactly what changes from current state to DI-wired state**

**Status**: Phase 0 Complete - Infrastructure scaffolded, singleton kept for backward compatibility

---

## 1. Repository: Singleton → Pure DI

**Status**: ✅ Phase 0 - Singleton kept, DI-ready  
**Note**: Singleton removal happens in **Phase 1.1** when wiring to live code begins.

### ❌ Current (Anti-pattern) - Kept in Phase 0

```typescript
// packages/features/webhooks/lib/repository/WebhookRepository.ts

export class WebhookRepository implements IWebhookRepository {
  private static _instance: WebhookRepository;
  
  constructor(private prisma: PrismaClient = defaultPrisma) {}
  //                                        ^^^^^^^^^^^^^^
  //                                        Default parameter - allows both DI and legacy usage
  
  /**
   * Singleton accessor for backward compatibility.
   * @deprecated Use DI container (getWebhookFeature().repository) instead
   */
  static getInstance(): WebhookRepository {
    if (!WebhookRepository._instance) {
      WebhookRepository._instance = new WebhookRepository(defaultPrisma);
    }
    return WebhookRepository._instance;
  }
  //      ^^^^^^^^^^^^^
  //      Kept temporarily for live code (TRPC handlers, delegation webhooks)
  
  async getSubscribers(options: GetSubscribersOptions) {
    const webhooks = await this.prisma.webhook.findMany(/* ... */);
    return webhooks;
  }
}

// Also kept for backward compatibility
export const webhookRepository = WebhookRepository.getInstance();
```

**Why Keep in Phase 0:**
- Avoids touching 3 live files (TRPC handlers, delegation webhooks)
- Maintains zero production impact during infrastructure setup
- Still supports DI through constructor injection
- Will be removed in Phase 1.1 when wiring starts

### ✅ Target (Pure DI) - Implemented in Phase 1.1

```typescript
// packages/features/webhooks/lib/repository/WebhookRepository.ts

export class WebhookRepository implements IWebhookRepository {
  constructor(private readonly prisma: PrismaClient) {}
  //          ^^^^^^^^^^^^^^^^^ No default! Pure DI.
  //          readonly = immutable after construction
  
  // NO SINGLETON - Container manages lifecycle
  // NO getInstance() - Use getWebhookFeature().repository
  
  async getSubscribers(options: GetSubscribersOptions) {
    // Uses injected Prisma (can be real or mock)
    const webhooks = await this.prisma.webhook.findMany(/* ... */);
    return webhooks;
  }
}

// No singleton export - use DI container
```

**Benefits:**
- Pure dependency injection
- Easy to test (inject mock Prisma)
- Container manages single instance
- Can swap Prisma (e.g., read-only replica)

---

## 2. Container: Missing Prisma → Fully Wired

**Status**: ✅ Phase 0 Complete - Prisma integrated, facade exported

### ❌ Before Phase 0

```typescript
// packages/features/di/webhooks/containers/webhook.ts

import { createContainer } from "@evyweb/ioctopus";
import { moduleLoader as loggerModuleLoader } from "../../shared/services/logger.service";
import { taskerServiceModule } from "../../shared/services/tasker.service";
import { SHARED_TOKENS } from "../../shared/shared.tokens";
import { WEBHOOK_TOKENS } from "../Webhooks.tokens";
import { webhookModule } from "../modules/Webhook.module";

export const webhookContainer = createContainer();

// ❌ NO PRISMA MODULE LOADED!

// Load shared infrastructure
loggerModuleLoader.loadModule(webhookContainer);
webhookContainer.load(SHARED_TOKENS.TASKER, taskerServiceModule);

// Load webhook module
webhookContainer.load(WEBHOOK_TOKENS.WEBHOOK_REPOSITORY, webhookModule);
webhookContainer.load(WEBHOOK_TOKENS.WEBHOOK_SERVICE, webhookModule);
// ... other services

// Individual getters (no types!)
export function getBookingWebhookService() {
  return webhookContainer.get(WEBHOOK_TOKENS.BOOKING_WEBHOOK_SERVICE);
  //     ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  //     No type annotation - returns 'any'
}

// ❌ NO FACADE EXPORT!
```

**Problems (Fixed in Phase 0):**
- ~~Prisma not loaded~~ ✅ Fixed
- ~~No type annotations on getters~~ ✅ Fixed
- ~~No unified facade~~ ✅ Fixed
- ~~Repository can't be resolved properly~~ ✅ Fixed

### ✅ Current (Phase 0 Complete)

```typescript
// packages/features/di/webhooks/containers/webhook.ts

import { createContainer } from "@evyweb/ioctopus";
import { moduleLoader as prismaModuleLoader } from "@calcom/features/di/modules/Prisma";
//       ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
//       ADD: Prisma module loader
import { moduleLoader as loggerModuleLoader } from "../../shared/services/logger.service";
import { taskerServiceModule } from "../../shared/services/tasker.service";
import { SHARED_TOKENS } from "../../shared/shared.tokens";
import { WEBHOOK_TOKENS } from "../Webhooks.tokens";
import { webhookModule } from "../modules/Webhook.module";
import { createWebhookFeature, type WebhookFeature } from "@calcom/features/webhooks/lib/facade/WebhookFeature";
//       ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
//       ADD: Facade factory and type
import type { IBookingWebhookService, IFormWebhookService } from "@calcom/features/webhooks/lib/interface/services";
//       ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
//       ADD: Service types for getters

export const webhookContainer = createContainer();

// ✅ LOAD PRISMA FIRST
prismaModuleLoader.loadModule(webhookContainer);

// Load shared infrastructure
loggerModuleLoader.loadModule(webhookContainer);
webhookContainer.load(SHARED_TOKENS.TASKER, taskerServiceModule);

// Load webhook module
webhookContainer.load(WEBHOOK_TOKENS.WEBHOOK_REPOSITORY, webhookModule);
webhookContainer.load(WEBHOOK_TOKENS.WEBHOOK_SERVICE, webhookModule);
// ... other services

// ============================================================================
// ✅ PRIMARY EXPORT - Facade pattern
// ============================================================================

/**
 * Get the complete WebhookFeature facade.
 * This is the recommended way to access webhook services.
 */
export async function getWebhookFeature(): Promise<WebhookFeature> {
  return createWebhookFeature(webhookContainer);
}

// ============================================================================
// Individual getters (with proper types)
// ============================================================================

export function getBookingWebhookService() {
  return webhookContainer.get<IBookingWebhookService>(WEBHOOK_TOKENS.BOOKING_WEBHOOK_SERVICE);
  //                         ^^^^^^^^^^^^^^^^^^^^^^^ Type annotation!
}

export function getFormWebhookService() {
  return webhookContainer.get<IFormWebhookService>(WEBHOOK_TOKENS.FORM_WEBHOOK_SERVICE);
}

// ... other typed getters
```

**Benefits:**
- Prisma injected via DI
- Type-safe getters
- Unified facade for ease of use
- All services resolvable

---

## 3. Module: No Prisma Dependency → Proper Binding

### ❌ Current

```typescript
// packages/features/di/webhooks/modules/Webhook.module.ts

import { createModule } from "@evyweb/ioctopus";
import { WebhookRepository } from "@calcom/features/webhooks/lib/repository/WebhookRepository";
import { WEBHOOK_TOKENS } from "../Webhooks.tokens";

export const webhookModule = createModule();

// Bind repository (no dependencies specified!)
webhookModule.bind(WEBHOOK_TOKENS.WEBHOOK_REPOSITORY).toClass(WebhookRepository);
//                                                                ^^^^^^^^^^^^^^
//                                                                No [DI_TOKENS.PRISMA_CLIENT]!
```

**Problem:**
- Repository binding doesn't specify Prisma dependency
- Container doesn't know to inject Prisma
- Falls back to default parameter (defeats DI)

### ✅ Target

```typescript
// packages/features/di/webhooks/modules/Webhook.module.ts

import { createModule } from "@evyweb/ioctopus";
import { DI_TOKENS } from "@calcom/features/di/tokens";
//       ^^^^^^^^^^ ADD: Import main DI_TOKENS for Prisma
import { WebhookRepository } from "@calcom/features/webhooks/lib/repository/WebhookRepository";
import { WEBHOOK_TOKENS } from "../Webhooks.tokens";

export const webhookModule = createModule();

// Bind repository WITH Prisma dependency
webhookModule
  .bind(WEBHOOK_TOKENS.WEBHOOK_REPOSITORY)
  .toClass(WebhookRepository, [DI_TOKENS.PRISMA_CLIENT]);
  //                          ^^^^^^^^^^^^^^^^^^^^^^^^^ Prisma injected!
```

**Benefits:**
- Prisma properly injected by container
- No default parameters needed
- Testable (can inject mock Prisma)

---

## 4. Tokens: Isolated → Integrated

### ❌ Current

```typescript
// packages/features/di/webhooks/Webhooks.tokens.ts

export const WEBHOOK_TOKENS = {
  WEBHOOK_SERVICE: Symbol("IWebhookService"),
  BOOKING_WEBHOOK_SERVICE: Symbol("IBookingWebhookService"),
  // ... other tokens
} as const;

// ❌ Not exported from main DI_TOKENS!
```

```typescript
// packages/features/di/tokens.ts

export const DI_TOKENS = {
  PRISMA_CLIENT: Symbol("PrismaClient"),
  // ... other tokens
  
  // ❌ NO WEBHOOK_TOKENS HERE!
};
```

**Problem:**
- Webhook tokens isolated (not in main DI_TOKENS)
- Inconsistent with other features (watchlist, bookings, etc.)
- Hard to discover

### ✅ Target

```typescript
// packages/features/di/webhooks/Webhooks.tokens.ts

export const WEBHOOK_TOKENS = {
  WEBHOOK_SERVICE: Symbol("IWebhookService"),
  BOOKING_WEBHOOK_SERVICE: Symbol("IBookingWebhookService"),
  // ... other tokens
} as const;
```

```typescript
// packages/features/di/tokens.ts

import { WEBHOOK_TOKENS } from "./webhooks/Webhooks.tokens";

export const DI_TOKENS = {
  PRISMA_CLIENT: Symbol("PrismaClient"),
  // ... other tokens
  
  // ✅ INCLUDE WEBHOOK_TOKENS
  ...WEBHOOK_TOKENS,
};
```

**Benefits:**
- Consistent with other features
- Discoverable via main DI_TOKENS
- Follows established patterns

---

## 5. Usage: Direct Functions → Producer/Consumer Pattern

### ❌ Current Production Usage

```typescript
// packages/features/bookings/lib/handleWebhookTrigger.ts

import getWebhooks from "@calcom/features/webhooks/lib/getWebhooks";
import sendPayload from "@calcom/features/webhooks/lib/sendOrSchedulePayload";
import logger from "@calcom/lib/logger";

async function handleWebhookTrigger(args: {
  subscriberOptions: GetSubscriberOptions;
  eventTrigger: string;
  webhookData: WebhookPayloadType;
}) {
  // ❌ Direct function calls (no DI)
  const subscribers = await getWebhooks(args.subscriberOptions);
  
  // ❌ Manual Promise.all orchestration
  const promises = subscribers.map((sub) =>
    sendPayload(sub.secret, args.eventTrigger, new Date().toISOString(), sub, args.webhookData)
      .catch((e) => {
        logger.error(`Error executing webhook for event: ${args.eventTrigger}`, e);
      })
  );
  
  await Promise.all(promises);
}
```

**Problems:**
- No dependency injection
- Direct function imports
- Manual orchestration (error handling, logging)
- Hard to test (can't mock easily)
- Scattered logic

### ✅ Target Production Usage (Producer/Consumer Pattern)

**Architecture:** Mirror Booking Audit pattern with Producer/Consumer separation

```typescript
// packages/features/bookings/lib/onBookingEvents/BookingEventHandlerService.ts

import type { IWebhookProducerService } from "@calcom/features/webhooks/lib/service/WebhookProducerService.interface";
//              ^^^^^^^^^^^^^^^^^^^^^^^^^ Use Producer interface

export class BookingEventHandlerService {
  constructor(
    private readonly bookingAuditProducerService: BookingAuditProducerService,
    private readonly webhookProducerService: IWebhookProducerService,  // ← Injected via DI
    private readonly log: ILogger
  ) {}
  
  async onBookingCancelled(params: OnBookingCancelledParams) {
    const { bookingUid, eventTypeId, userId, teamId, organizationId, operationId } = params;
    
    // ✅ Orchestrate all side effects (audit + webhooks)
    await Promise.allSettled([
      // Audit
      this.bookingAuditProducerService.queueCancelledAudit({
        bookingUid,
        actor: params.actor,
        organizationId,
        source: params.source,
        operationId,
        data: params.auditData,
      }),
      
      // Webhooks (lightweight - just queue)
      this.webhookProducerService.queueBookingCancelledWebhook({
        bookingUid,
        eventTypeId,
        userId,
        teamId,
        organizationId,
        triggerEvent: "BOOKING_CANCELLED",
        operationId,
      }),
    ]);
  }
}
```

**Producer Service (Lightweight - stays in main app):**
```typescript
// packages/features/webhooks/lib/service/WebhookTaskerProducerService.ts

export class WebhookTaskerProducerService implements IWebhookProducerService {
  constructor(
    private readonly tasker: ITasker,
    private readonly logger: ILogger
    // NO Prisma, NO repositories, NO payload builders
  ) {}
  
  async queueBookingCancelledWebhook(params: {
    bookingUid: string;
    eventTypeId: number;
    userId?: number | null;
    teamId?: number | null;
    organizationId?: number | null;
    triggerEvent: WebhookTriggerEvents;
    operationId?: string | null;
  }): Promise<void> {
    const operationId = params.operationId ?? uuidv4();
    
    try {
      // Just queue - no processing
      await this.tasker.create("webhookDelivery", {
        bookingUid: params.bookingUid,
        eventTypeId: params.eventTypeId,
        userId: params.userId,
        teamId: params.teamId,
        organizationId: params.organizationId,
        triggerEvent: params.triggerEvent,
        operationId,
        timestamp: Date.now(),
      });
      
      this.logger.info(`Queued webhook: ${params.triggerEvent}`);
    } catch (error) {
      this.logger.error(`Failed to queue webhook: ${error}`);
      throw error;
    }
  }
}
```

**Consumer Service (Heavy - deployed to trigger.dev):**
```typescript
// packages/features/webhooks/lib/service/WebhookTaskConsumer.ts

export class WebhookTaskConsumer {
  constructor(
    private readonly webhookRepository: IWebhookRepository,      // Heavy dep
    private readonly payloadBuilderFactory: PayloadBuilderFactory, // Heavy dep
    private readonly bookingRepository: IBookingRepository,       // Heavy dep
    private readonly logger: ILogger
  ) {}
  
  async processWebhookTask(payload: WebhookTaskPayload, taskId: string): Promise<void> {
    const { bookingUid, triggerEvent, eventTypeId, userId, teamId, organizationId } = payload;
    
    // 1. Fetch subscribers (DB query)
    const subscribers = await this.webhookRepository.getSubscribers({
      userId,
      eventTypeId,
      teamId,
      triggerEvent,
      organizationId,
    });
    
    if (subscribers.length === 0) {
      this.logger.info(`No subscribers for ${triggerEvent}`);
      return;
    }
    
    // 2. Fetch booking data (DB query)
    const booking = await this.bookingRepository.findByUid(bookingUid);
    
    // 3. Build versioned payloads
    const results = await Promise.allSettled(
      subscribers.map(async (subscriber) => {
        const builder = this.payloadBuilderFactory.getBuilder(subscriber.version);
        const webhookPayload = builder.buildBookingPayload(booking, triggerEvent);
        
        // 4. Send webhook (HTTP call)
        await this.sendWebhook(subscriber, webhookPayload);
      })
    );
    
    this.logger.info(`Processed webhooks: ${results.length} sent for ${triggerEvent}`);
  }
  
  private async sendWebhook(subscriber, payload) {
    // HTTP call to subscriber.subscriberUrl
  }
}
```

**Benefits:**
- ✅ **Lightweight producer** - No heavy deps, fast queuing
- ✅ **Heavy consumer on trigger.dev** - DB queries, payload building isolated
- ✅ **Scalable** - Consumer scales independently
- ✅ **Consistent** - Mirrors audit architecture (team already understands)
- ✅ **DI compliant** - All dependencies injected
- ✅ **Single code path** - No coexistence, just queue system
- ✅ **Testable** - Easy to mock producer/consumer separately

**⚠️ CRITICAL: Payload Compatibility Validation Required**

Before wiring this new architecture, we **must validate** that Producer/Consumer generates **identical webhook payloads** to current implementation:

```typescript
// Payload Validation Test Example
describe("Payload Compatibility: BOOKING_CREATED", () => {
  it("new Producer/Consumer matches current implementation", async () => {
    const testBooking = fixtures.createBooking();
    const testEventType = fixtures.createEventType();
    
    // Current implementation (BookingWebhookService)
    const currentPayload = await getCurrentBookingCreatedPayload(
      testBooking, 
      testEventType
    );
    
    // New Producer/Consumer implementation
    const newPayload = await getProducerConsumerBookingCreatedPayload(
      testBooking, 
      testEventType
    );
    
    // Must match exactly (except timestamp/operationId)
    expect(newPayload).toMatchObject(
      omit(currentPayload, ["timestamp", "operationId"])
    );
    
    // Verify all required fields
    expect(newPayload).toHaveProperty("triggerEvent", "BOOKING_CREATED");
    expect(newPayload).toHaveProperty("booking.uid", testBooking.uid);
    expect(newPayload).toHaveProperty("eventType.id", testEventType.id);
    // ... verify ALL fields
  });
});
```

**Why This Matters:**
- Webhooks are **external contracts** with third-party systems
- Payload changes = **breaking changes** for customers
- Must verify compatibility before replacing production system
- **Blocker**: Cannot proceed to wiring until all validation tests pass

See **Phase 0, Section 0.9: Payload Compatibility Validation** for complete validation plan.

**How It Works:**
```
BookingEventHandlerService
    ↓
webhookProducerService.queueBookingCancelledWebhook()
    ↓
Tasker.create("webhookDelivery", { minimal payload })
    ↓
[Task Queue - can be trigger.dev]
    ↓
webhookTaskConsumer.processWebhookTask(payload, taskId)
    ↓
- Fetch subscribers
- Fetch booking data
- Build versioned payloads
- Send HTTP requests to all subscribers
```

**DI Wiring:**
```typescript
// Producer module
webhookProducerModule
  .bind(WEBHOOK_TOKENS.WEBHOOK_PRODUCER_SERVICE)
  .toClass(WebhookTaskerProducerService, [SHARED_TOKENS.TASKER, SHARED_TOKENS.LOGGER]);

// Consumer module
webhookConsumerModule
  .bind(WEBHOOK_TOKENS.WEBHOOK_TASK_CONSUMER)
  .toClass(WebhookTaskConsumer, [
    WEBHOOK_TOKENS.WEBHOOK_REPOSITORY,
    WEBHOOK_TOKENS.PAYLOAD_BUILDER_FACTORY,
    BOOKING_TOKENS.BOOKING_REPOSITORY,
    SHARED_TOKENS.LOGGER,
  ]);
```

---

## 6. Testing: Singletons → Container Mocking

### ❌ Current Testing

```typescript
// Test file

import { WebhookRepository } from "@calcom/features/webhooks/lib/repository/WebhookRepository";
import { vi } from "vitest";

describe("Webhook tests", () => {
  test("should send webhook", async () => {
    // ❌ Can't easily mock repository (singleton)
    const mockPrisma = {
      webhook: {
        findMany: vi.fn().mockResolvedValue([/* mocked webhooks */]),
      },
    };
    
    // ❌ Have to work around singleton
    const repo = new WebhookRepository(mockPrisma as any);
    
    // ❌ Hard to inject into services
    const service = new WebhookService(repo, tasker, logger);
    
    // Test...
  });
});
```

**Problems:**
- Can't easily mock repository (singleton)
- Manual service instantiation
- Hard to set up dependencies
- Brittle tests

### ✅ Target Testing

```typescript
// Test file

import { vi } from "vitest";
import type { WebhookFeature } from "@calcom/features/webhooks/lib/facade/WebhookFeature";

vi.mock("@calcom/features/di/webhooks/containers/webhook", () => ({
  getWebhookFeature: vi.fn(),
}));

describe("Webhook tests", () => {
  beforeEach(async () => {
    const { getWebhookFeature } = await import("@calcom/features/di/webhooks/containers/webhook");
    
    // ✅ Mock entire facade (clean and simple)
    vi.mocked(getWebhookFeature).mockResolvedValue({
      booking: {
        emitBookingCreated: vi.fn(),
        emitBookingCancelled: vi.fn(),
      },
      form: {
        emitFormSubmitted: vi.fn(),
      },
      // ... other services
    } as WebhookFeature);
  });
  
  test("should send webhook", async () => {
    const { getWebhookFeature } = await import("@calcom/features/di/webhooks/containers/webhook");
    
    const webhooks = await getWebhookFeature();
    
    // ✅ Easy to call and verify
    await webhooks.booking.emitBookingCreated({
      booking: mockBooking,
      eventType: mockEventType,
      triggerEvent: "BOOKING_CREATED",
    });
    
    // ✅ Simple assertion
    expect(webhooks.booking.emitBookingCreated).toHaveBeenCalledWith({
      booking: mockBooking,
      eventType: mockEventType,
      triggerEvent: "BOOKING_CREATED",
    });
  });
});
```

**Benefits:**
- Mock entire container/facade
- No manual instantiation
- Easy to set up
- Clean tests

---

## 7. File Structure: Duplicates → Clean Separation

### ❌ Current

```
packages/features/
├── di/
│   └── webhooks/
│       ├── repositories/
│       │   └── Webhook.repository.ts        ❌ DUPLICATE! (should not exist)
│       ├── services/
│       │   └── Webhook.service.ts           ❌ DUPLICATE! (should not exist)
│       ├── modules/
│       │   └── Webhook.module.ts            ✅ OK (DI wiring)
│       └── containers/
│           └── webhook.ts                   ✅ OK (container setup)
│
└── webhooks/
    └── lib/
        ├── repository/
        │   └── WebhookRepository.ts         ✅ Real implementation
        └── service/
            └── WebhookService.ts            ✅ Real implementation
```

**Problem:**
- Duplicate files in DI folder
- Confusing (which is the real implementation?)
- Violates DRY (Don't Repeat Yourself)

### ✅ Target

```
packages/features/
├── di/
│   └── webhooks/
│       ├── repositories/                    ✅ EMPTY (just for structure)
│       ├── services/                        ✅ EMPTY (just for structure)
│       ├── modules/
│       │   └── Webhook.module.ts            ✅ DI wiring only
│       ├── containers/
│       │   └── webhook.ts                   ✅ Container setup only
│       └── Webhooks.tokens.ts               ✅ Tokens only
│
└── webhooks/
    └── lib/
        ├── facade/
        │   └── WebhookFeature.ts            ✨ NEW (facade)
        ├── repository/
        │   └── WebhookRepository.ts         ✅ Real implementation
        └── service/
            └── WebhookService.ts            ✅ Real implementation
```

**Benefits:**
- Clear separation: DI folder = wiring, lib folder = implementation
- No duplicates
- Follows watchlist pattern (reference)

---

## 8. API Surface: Scattered → Unified Facade

### ❌ Current (Scattered)

```typescript
// Multiple ways to do the same thing:

// Way 1: Direct functions
import getWebhooks from "@calcom/features/webhooks/lib/getWebhooks";
import sendPayload from "@calcom/features/webhooks/lib/sendPayload";

// Way 2: Repository singleton
import { WebhookRepository } from "@calcom/features/webhooks/lib/repository/WebhookRepository";
const repo = WebhookRepository.getInstance();

// Way 3: DI getters (unused)
import { getBookingWebhookService } from "@calcom/features/di/webhooks/containers/webhook";

// Way 4: Direct service instantiation
import { BookingWebhookService } from "@calcom/features/webhooks/lib/service/BookingWebhookService";
const service = new BookingWebhookService(...);
```

**Problems:**
- 4+ ways to access webhooks
- Inconsistent patterns
- Confusing for developers
- Hard to deprecate old patterns

### ✅ Target (Unified)

```typescript
// ✅ ONE PRIMARY WAY (Recommended)
import { getWebhookFeature } from "@calcom/features/di/webhooks/containers/webhook";
const webhooks = await getWebhookFeature();

// Access all webhook functionality through facade:
await webhooks.booking.emitBookingCreated(params);
await webhooks.form.emitFormSubmitted(params);
await webhooks.recording.emitRecordingReady(params);
await webhooks.ooo.emitOOOCreated(params);

// ✅ Alternative: Operations layer (even simpler)
import { sendBookingCreatedWebhookController } from "@calcom/features/webhooks/operations/send-booking-webhook.controller";
await sendBookingCreatedWebhookController(params);

// ✅ For advanced users: Individual services
import { getBookingWebhookService } from "@calcom/features/di/webhooks/containers/webhook";
const service = getBookingWebhookService();
```

**Benefits:**
- Single recommended pattern
- Consistent across codebase
- Easy to discover
- Simple to deprecate old patterns

---

## Summary Table

| Aspect | Current (❌) | Target (✅) | Benefit |
|--------|-------------|------------|---------|
| **Repository** | Singleton + default Prisma | Pure DI with injected Prisma | Testable, no global state |
| **Container** | No Prisma, no facade | Prisma + facade | Fully wired, easy to use |
| **Module** | No Prisma dependency | Prisma in bindings | Proper injection |
| **Tokens** | Isolated | In main DI_TOKENS | Consistent, discoverable |
| **Usage** | Direct functions | DI services via facade | Clean, testable, type-safe |
| **Testing** | Manual mocking | Container mocking | Easy, clean tests |
| **Structure** | Duplicates in DI folder | Clean separation | Clear, maintainable |
| **API** | 4+ scattered patterns | 1 unified facade | Consistent, simple |
| **Production** | 0% DI usage | 100% DI usage | Modern, maintainable |

---

## Migration Path

```
┌─────────────────┐
│  Current State  │  ← 25+ files using direct functions
│                 │  ← Singleton repository
│  (No DI in     │  ← No Prisma in container
│   production)  │
└────────┬────────┘
         │
         │ Sprint 1: Add Prisma integration
         ↓
┌─────────────────┐
│  Infrastructure │  ← Prisma in container
│     Wired       │  ← Repository uses DI
│                 │  ← Tokens integrated
└────────┬────────┘
         │
         │ Sprint 2: Create facade & operations
         ↓
┌─────────────────┐
│  Facade Ready   │  ← getWebhookFeature() works
│                 │  ← Operations layer exists
│                 │  ← Tests written
└────────┬────────┘
         │
         │ Sprint 3-4: Migrate production usage
         ↓
┌─────────────────┐
│  Partially      │  ← Some files use DI
│   Migrated      │  ← Old code still works
│                 │  ← Feature flags in place
└────────┬────────┘
         │
         │ Sprint 5: Deprecate old patterns
         ↓
┌─────────────────┐
│  Fully Migrated │  ← All files use DI
│                 │  ← Old functions deprecated
│                 │  ← Warnings in dev
└────────┬────────┘
         │
         │ Sprint 6: Remove deprecated (6 months)
         ↓
┌─────────────────┐
│  Target State   │  ← 100% DI compliance
│                 │  ← Clean codebase
│  (Full DI)     │  ← Consistent patterns
└─────────────────┘
```

---

## Quick Start Checklist

Want to start wiring? Follow this checklist:

**Sprint 1: Infrastructure**
- [ ] Add `prismaModuleLoader.loadModule(webhookContainer)` to container
- [ ] Remove `getInstance()` from WebhookRepository
- [ ] Remove default parameter from WebhookRepository constructor
- [ ] Add `[DI_TOKENS.PRISMA_CLIENT]` to repository binding
- [ ] Export `WEBHOOK_TOKENS` from main `DI_TOKENS`
- [ ] Delete `/di/webhooks/repositories/Webhook.repository.ts`
- [ ] Delete `/di/webhooks/services/Webhook.service.ts`
- [ ] Test: Verify all services resolve from container

**Sprint 2: Facade**
- [ ] Create `/webhooks/lib/facade/WebhookFeature.ts`
- [ ] Implement `createWebhookFeature(container)` factory
- [ ] Export `getWebhookFeature()` from container
- [ ] Add type annotations to all getters
- [ ] Create `/webhooks/operations/send-booking-webhook.controller.ts`
- [ ] Write tests for facade and operations

**Ready to migrate!** Follow the full wiring plan for remaining sprints.

---

For the complete implementation guide, see `WIRING_PLAN.md`.
