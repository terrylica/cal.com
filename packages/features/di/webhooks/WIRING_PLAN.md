# Webhooks DI Wiring Plan

**Status:** Phase 0 Complete - Ready for Phase 1  
**Last Updated:** December 15, 2025  
**Owner:** Engineering Team

---

## ⚠️ **BEFORE YOU START**

**📋 [CODE_STANDARDS.md](./CODE_STANDARDS.md) - MANDATORY CODE STANDARDS & PR CHECKLIST**

Every PR must comply with these standards:
- ✅ No placeholder tests, no `as any`, discriminated unions, SOLID compliance
- ✅ Strict DI with Ioctopus, ≤500 lines, ≤10 files per PR
- ✅ **Review the checklist before every commit**

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current State Analysis](#current-state-analysis)
3. [Webhook Payload Flow (Producer-Consumer Architecture)](#webhook-payload-flow-producer-consumer-architecture)
4. [DI Compliance & SOLID Assessment](#di-compliance--solid-assessment)
5. [Working Implementation vs Scaffolding](#working-implementation-vs-scaffolding)
6. [Wiring Phase Plan](#wiring-phase-plan)
7. [Implementation Roadmap](#implementation-roadmap)
8. [Migration Strategy](#migration-strategy)
9. [Testing Strategy](#testing-strategy)
10. [Success Criteria](#success-criteria)

---

## Executive Summary

The Webhooks feature has a **dual implementation** that needs consolidation:

1. **Scaffolding (DI-based)**: Complete DI structure with proper dependency injection, but disconnected from production usage
2. **Working Implementation (Direct instantiation)**: Production code using utility functions (`sendPayload`, `getWebhooks`) without DI

**Goal**: Wire the DI scaffolding into production by creating the missing bridge layer (facade + operations) and migrating existing usage patterns to the DI container.

**Key Findings**:
- ✅ DI scaffolding is well-structured and follows modern service patterns
- ❌ Missing Prisma integration in DI setup
- ❌ No facade pattern for unified API surface
- ❌ Zero production usage of DI services
- ❌ Tokens not integrated into main DI_TOKENS
- ❌ Duplicate module files in DI folder

---

## Current State Analysis

### 1. DI Scaffolding Structure

**Location**: `/packages/features/di/webhooks/`

```
packages/features/di/webhooks/
├── Webhooks.tokens.ts                   ✅ Complete token definitions
├── modules/
│   └── Webhook.module.ts                ✅ All services properly bound
├── containers/
│   └── webhook.ts                       ⚠️  Partially complete (missing facade)
├── repositories/
│   └── Webhook.repository.ts            ❌ DUPLICATE - Should not exist
└── services/
    └── Webhook.service.ts               ❌ DUPLICATE - Should not exist
```

**What Works**:
- ✅ All tokens defined (`WEBHOOK_SERVICE`, `BOOKING_WEBHOOK_SERVICE`, etc.)
- ✅ Module bindings complete with proper dependency chains
- ✅ Container created and services loadable
- ✅ Individual getter functions exist

**What's Missing**:
- ❌ Prisma module not loaded in container
- ❌ No facade pattern (`getWebhookFeature()`)
- ❌ Tokens not exported in main `DI_TOKENS`
- ❌ No operations/controller layer
- ❌ Duplicate files in DI folder (should only be in `/lib/`)

### 2. Working Implementation Structure

**Location**: `/packages/features/webhooks/lib/`

```
packages/features/webhooks/lib/
├── service/                             ✅ All service implementations
│   ├── WebhookService.ts
│   ├── BookingWebhookService.ts
│   ├── FormWebhookService.ts
│   ├── RecordingWebhookService.ts
│   ├── OOOWebhookService.ts
│   ├── WebhookNotifier.ts
│   └── WebhookNotificationHandler.ts
├── repository/
│   └── WebhookRepository.ts             ✅ Repository implementation
├── factory/                             ✅ Payload builders
├── interface/                           ✅ All interfaces defined
│   ├── services.ts
│   ├── IWebhookRepository.ts
│   └── infrastructure.ts
├── dto/                                 ✅ Data transfer objects
├── sendPayload.ts                       🔴 Direct usage (no DI)
├── getWebhooks.ts                       🔴 Direct usage (no DI)
├── schedulePayload.ts                   🔴 Direct usage (no DI)
└── sendOrSchedulePayload.ts             🔴 Direct usage (no DI)
```

**Current Production Usage Pattern**:

```typescript
// In booking handlers, form submissions, etc.
import getWebhooks from "@calcom/features/webhooks/lib/getWebhooks";
import sendPayload from "@calcom/features/webhooks/lib/sendOrSchedulePayload";

// Direct function calls - NO DI
const subscribers = await getWebhooks({
  userId,
  eventTypeId,
  triggerEvent: "BOOKING_CREATED",
  teamId,
});

await Promise.all(
  subscribers.map((sub) =>
    sendPayload(sub.secret, triggerEvent, new Date().toISOString(), sub, webhookData)
  )
);
```

**Used By** (25+ files):
- `packages/features/bookings/lib/handleWebhookTrigger.ts`
- `packages/features/bookings/lib/handleConfirmation.ts`
- `packages/features/bookings/lib/handleCancelBooking.ts`
- `packages/app-store/routing-forms/lib/formSubmissionUtils.ts`
- `packages/trpc/server/routers/viewer/ooo/outOfOfficeCreateOrUpdate.handler.ts`
- Many more...

### 3. Service Implementation Quality

**All services follow proper DI patterns**:

```typescript
// packages/features/webhooks/lib/service/WebhookService.ts
export class WebhookService implements IWebhookService {
  constructor(
    private readonly repository: IWebhookRepository,
    private readonly tasker: ITasker,
    logger: ILogger
  ) {
    this.log = logger.getSubLogger({ prefix: ["[WebhookService]"] });
  }
  // ... methods
}
```

✅ **Constructor injection** - All dependencies injected via constructor  
✅ **Interface-based** - Services implement interfaces  
✅ **No direct instantiation** - Ready for DI container usage  
✅ **Proper logging** - Logger injected and scoped

**Problem**: These services are never instantiated via DI in production!

### 4. Repository Implementation

**Current State** (`WebhookRepository.ts`):

```typescript
export class WebhookRepository implements IWebhookRepository {
  constructor(private prisma: PrismaClient = defaultPrisma) {}
  
  private static _instance: WebhookRepository;
  
  static getInstance(): WebhookRepository {
    if (!WebhookRepository._instance) {
      WebhookRepository._instance = new WebhookRepository();
    }
    return WebhookRepository._instance;
  }
  // ... methods
}
```

⚠️ **Issues**:
- Uses **singleton pattern** (anti-pattern for DI)
- Has **default parameter** for Prisma (defeats DI purpose)
- Not wired to DI container's Prisma module

**Should Be** (after Prisma integration):

```typescript
export class WebhookRepository implements IWebhookRepository {
  constructor(private readonly prisma: PrismaClient) {}
  // No singleton, no defaults - pure DI
}
```

---

## Webhook Payload Flow (Producer-Consumer Architecture)

This section documents the complete flow from webhook trigger to payload delivery, using **BOOKING_RESCHEDULED** as an example. Use this as a reference when adding new fields or debugging payload issues.

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           WEBHOOK PAYLOAD FLOW                                   │
│                        (BOOKING_RESCHEDULED Example)                             │
│                     Production: Trigger.dev (no DB task storage)                 │
└─────────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────┐
│  1. TRIGGER POINT    │   RegularBookingService.ts / handleConfirmation.ts
│  (Entry Point)       │   
└──────────┬───────────┘
           │
           │  Calls: webhookProducer.queueBookingRescheduledWebhook({
           │    bookingUid, eventTypeId, userId, teamId, orgId,
           │    rescheduleId, rescheduleUid, rescheduleStartTime,
           │    rescheduleEndTime, rescheduledBy, metadata,
           │    platformRescheduleUrl, platformCancelUrl, platformBookingUrl
           │  })
           ▼
┌──────────────────────┐
│  2. PRODUCER         │   WebhookTaskerProducerService.ts
│  (Queue Task)        │   
└──────────┬───────────┘
           │
           │  Creates WebhookTaskPayload and queues via WebhookTasker:
           │  webhookTasker.deliverWebhook({
           │    operationId, triggerEvent, bookingUid, eventTypeId,
           │    teamId, userId, orgId, oAuthClientId,
           │    platformRescheduleUrl, platformCancelUrl, platformBookingUrl,
           │    rescheduleId, rescheduleUid, rescheduleStartTime,
           │    rescheduleEndTime, rescheduledBy, metadata, timestamp
           │  })
           │  → WebhookTriggerTasker: deliverWebhook.trigger(payload) → Trigger.dev
           ▼
┌──────────────────────┐
│  3. TRIGGER.DEV      │   Trigger.dev (cloud queue; no DB task table)
│  (Async Processing)  │   Task ID: webhook.deliver
└──────────┬───────────┘
           │
           │  Trigger.dev worker runs: tasker/trigger/deliver-webhook.ts
           │  run(payload, { ctx }) → getWebhookTaskConsumer().processWebhookTask(payload, ctx.run.id)
           ▼
┌──────────────────────┐
│  4. CONSUMER         │   WebhookTaskConsumer.ts
│  (Orchestrator)      │   
└──────────┬───────────┘
           │
           │  Step 4a: Get DataFetcher for trigger type
           │  Step 4b: Fetch webhook subscribers
           │  Step 4c: Fetch event data from DB
           │  Step 4d: Build DTO and send webhooks
           ▼
┌──────────────────────┐
│  5. DATA FETCHER     │   BookingWebhookDataFetcher.ts
│  (DB Data Retrieval) │   
└──────────┬───────────┘
           │
           │  Fetches: bookingRepository.getBookingForCalEventBuilderFromUid()
           │  Builds:  CalendarEventBuilder.fromBooking(booking, platformMeta)
           │  Returns: { calendarEvent, booking, eventType }
           ▼
┌──────────────────────┐
│  6. DTO BUILDER      │   WebhookTaskConsumer.buildDTO()
│  (Data Transform)    │   
└──────────┬───────────┘
           │
           │  Transforms DB data to DTO shape:
           │  - eventType.title → eventTypeInfo.eventTitle
           │  - eventType.description → eventTypeInfo.eventDescription
           │  - Passes booking.assignmentReason for legacy format
           │  - Adds trigger-specific fields (rescheduleId, metadata, etc.)
           ▼
┌──────────────────────┐
│  7. PAYLOAD BUILDER  │   BookingPayloadBuilder.ts (v2021-10-20)
│  (Final Payload)     │   
└──────────┬───────────┘
           │
           │  Constructs final webhook payload:
           │  - Spreads CalendarEvent fields
           │  - Adds UTC offsets to organizer/attendees
           │  - Maps eventTypeInfo fields
           │  - Spreads extra fields (reschedule*, metadata, etc.)
           │  - Adds legacy assignmentReason from booking
           ▼
┌──────────────────────┐
│  8. WEBHOOK SERVICE  │   WebhookService.processWebhooks()
│  (HTTP Delivery)     │   
└──────────────────────┘
           │
           │  For each subscriber:
           │  - Apply payload template (if custom)
           │  - Sign payload with secret
           │  - Send HTTP POST to subscriberUrl
           │  - Handle retries/failures
           ▼
        [DELIVERED]
```

**E2E / sync mode:** When `ENABLE_ASYNC_TASKER` is false (e.g. E2E tests), `WebhookTasker` uses `WebhookSyncTasker`, which runs `WebhookTaskConsumer.processWebhookTask()` inline—no Trigger.dev and no queue. Steps 1 → 2 → 4 … 8 happen in the same process.

### What to do when adding or changing webhooks

Use the diagram steps and the **File Reference Table** below to know where to look. Two cases:

| Case | What to do | Where to touch (diagram step → files) |
|------|------------|----------------------------------------|
| **New trigger event** (new `WebhookTriggerEvents` value, e.g. a new webhook type) | Add full path for that trigger. | **Step 1:** Add call to `webhookProducer.queueXWebhook(params)` at the new trigger point (e.g. a service or handler). **Step 2:** Add `queueXWebhook` on `IWebhookProducerService` and `WebhookTaskerProducerService`; add or extend the task payload schema in `types/webhookTask.ts` so the payload carries what this trigger needs. **Step 3:** No change (same for all). **Step 4:** Implement a data fetcher for this trigger (e.g. `XWebhookDataFetcher`), register it in the consumer's `dataFetchers`, and if the webhook body shape is new, add DTO + payload builder and wire them in the consumer. Steps 5–8 are invoked from step 4 (reuse or add fetcher/builders as above). |
| **Existing trigger, new call site** (e.g. another place that should fire `BOOKING_RESCHEDULED`) | Reuse existing trigger; only add the call. | **Step 1 only:** Add a call to the existing `webhookProducer.queueXWebhook(params)` with the correct params at the new place. No changes to steps 2–8. |

**Adjusting existing triggers:** For any step, use the **File Reference Table** below: the step number in the diagram maps to the listed files and methods. To change how an existing trigger is queued, look at steps 1–2; to change how its payload is built or delivered, look at steps 4–8 and the files referenced there.

### When changing Step 4 (Consumer) or its DI
When you change WebhookTaskConsumer’s constructor (add/remove/reorder params), update packages/features/di/webhooks/modules/WebhookTaskConsumer.module.ts so the factory resolves and passes the same dependencies in the same order; mismatch causes wrong or undefined arguments (e.g. logger.getSubLogger on undefined)

### Future reference: BOOKING_REQUESTED migration (PR 27546)

**What the PR did:** Migrated BOOKING_REQUESTED webhook delivery from the legacy inline path (`handleWebhookTrigger` → `sendPayload`) to the producer–consumer pipeline (Trigger.dev or sync). When a booking is created with an event type that requires confirmation (`!isConfirmedByDefault`), the webhook is now queued via `webhookProducer.queueBookingRequestedWebhook(...)`; delivery runs through the tasker. If the webhook producer is not available (e.g. booking container without full webhook DI), the code falls back to the legacy path so the webhook still fires and the app does not crash.

**Files changed in PR 27546:**

| Area | File | Change |
|------|------|--------|
| Features – booking service | `packages/features/bookings/lib/service/RegularBookingService.ts` | Use `deps.webhookProducer.queueBookingRequestedWebhook(...)` when booking requires confirmation; fallback to `handleWebhookTrigger` when producer is undefined. `IBookingServiceDependencies.webhookProducer` is optional. |
| Features – booking DI | `packages/features/bookings/di/RegularBookingService.module.ts` | Wire `webhookProducer` via `webhookProducerModuleLoader` so contexts that use the booking container get the producer. |
| Standalone handler | `packages/features/bookings/lib/handleBookingRequested.ts` | Use `getWebhookProducer().queueBookingRequestedWebhook(...)` for the handler path. |
| Producer interface | `packages/features/webhooks/lib/interface/WebhookProducerService.ts` | Add `queueBookingRequestedWebhook` and params. |
| Task payload | `packages/features/webhooks/lib/types/webhookTask.ts` | Extend task payload for BOOKING_REQUESTED. |
| Consumer | `packages/features/webhooks/lib/service/WebhookTaskConsumer.ts` | Handle BOOKING_REQUESTED in data fetcher, DTO, payload builder. |
| Consumer DI | `packages/features/di/webhooks/modules/WebhookTaskConsumer.module.ts` | Resolve and pass all 5 constructor deps (incl. `logger`) so no undefined at runtime. |
| DTO / repo | `packages/features/webhooks/lib/dto/types.ts`, `WebhookRepository.ts`, `BookingRepository.ts`, `packages/lib/server/repository/dto/IBookingRepository.ts` | Support BOOKING_REQUESTED payload and repository usage. |
| Trigger.dev | `packages/features/trigger.config.ts` | Ensure webhook task dir is included. |
| Platform API (api/v2) | `packages/platform/libraries/index.ts` | Re-export `getWebhookProducer` and type `IWebhookProducerService` (api/v2 cannot import from `@calcom/features/di`). |
| Platform API (api/v2) | `apps/api/v2/src/lib/modules/regular-booking.module.ts` | Define `WEBHOOK_PRODUCER` token; add provider `useFactory: () => getWebhookProducer()`; export token. |
| Platform API (api/v2) | `apps/api/v2/src/lib/services/regular-booking.service.ts` | Inject `@Inject(WEBHOOK_PRODUCER) webhookProducer`, pass to base `RegularBookingService`. |

**How to test (from PR):**

- **Environment:** For Trigger.dev: `ENABLE_ASYNC_TASKER=true`, `TRIGGER_SECRET_KEY`, `TRIGGER_API_URL` set; worker running.
- **Setup:** One event type with “Requires confirmation” enabled; one webhook subscriber for BOOKING_REQUESTED (e.g. webhook.site).
- **Happy path:** Create a booking for that event type → BOOKING_REQUESTED webhook received; with Trigger.dev, a `webhook.deliver` run appears in the dashboard.
- **Fallback:** Web app booking flow without full webhook DI should still send the webhook (producer when available, legacy path when not); no crash, no `undefined.getSubLogger`.
- **E2E:** Run `PLAYWRIGHT_HEADLESS=1 yarn e2e apps/web/playwright/webhook.e2e.ts --grep "BOOKING_REQUESTED"` to confirm existing test passes.

### Two different "payloads" (don't mix them up)

| | **Task payload** (step 2) | **Delivery payload** (steps 6–7) |
|---|---------------------------|-----------------------------------|
| **What it is** | The small bag of IDs we put **in the queue** | The rich JSON body we **POST to the subscriber URL** |
| **When it’s built** | At queue time (trigger point) | When the task runs (consumer) |
| **Contains** | `bookingUid`, `eventTypeId`, `userId`, `teamId`, `orgId`, trigger-specific fields, `operationId`, `timestamp` | Full booking/event/organizer/attendees, event type title/description, metadata, etc. |
| **Purpose** | Tells the consumer *what* to fetch and *who* might be interested (subscribers) | What the integration actually receives in the HTTP request body |

**At queue time we do not build the delivery payload.** We only queue the task payload (identifiers). The actual webhook body (delivery payload) is built later in steps 5–7 from fresh DB data. That keeps the producer lightweight (no Prisma/repositories) and avoids stale data (e.g. booking updated after queue).

### How step 2 (Producer) and step 4 (Consumer) connect

You don’t need the consumer in step 2. The flow is:

1. **Step 2 only queues the task payload (identifiers).**  
   At the trigger point you have IDs and context. The producer builds a **WebhookTaskPayload** with just those and calls `webhookTasker.deliverWebhook(payload)`. It does **not** build the delivery payload or call the consumer.

2. **The task runtime invokes the consumer.**  
   When the task runs, the task code gets the consumer from DI and calls `webhookTaskConsumer.processWebhookTask(payload, taskId)`.

3. **The consumer builds the delivery payload and sends it.**  
   Using the task payload (IDs), the consumer: fetches subscribers, fetches full event data from the DB (step 5), **builds the delivery payload** from that data (steps 6–7), and POSTs it to each subscriber (step 8). So steps 4–8 exist because the **delivery payload is created at run time**, not at queue time.

### File Reference Table

| Step | File | Function/Method | Purpose |
|------|------|-----------------|---------|
| 1 | `RegularBookingService.ts` | `queueBookingRescheduledWebhook()` | Entry point - triggers webhook |
| 2 | `WebhookTaskerProducerService.ts` | `queueBookingRescheduledWebhook()` → `queueTask()` | Queues async task |
| 2 | `tasker/WebhookTriggerTasker.ts` | `deliverWebhook()` | Calls Trigger.dev task |
| 2 | `interface/WebhookProducerService.ts` | `QueueBookingWebhookParams` | Type for queue params |
| 2 | `types/webhookTask.ts` | `BookingWebhookTaskPayload` | Task payload schema |
| 3 | `tasker/trigger/deliver-webhook.ts` | `deliverWebhook` (Trigger.dev task) | Trigger.dev runs task; invokes consumer |
| 3 | `tasker/trigger/config.ts` | `webhookDeliveryQueue`, `webhookDeliveryTaskConfig` | Queue and retry config |
| 4 | `WebhookTaskConsumer.ts` | `processWebhookTask()` | Orchestrates processing |
| 5 | `data-fetchers/BookingWebhookDataFetcher.ts` | `fetchEventData()` | Fetches booking from DB |
| 5 | `BookingRepository.ts` | `getBookingForCalEventBuilderFromUid()` | DB select statement |
| 5 | `CalendarEventBuilder.ts` | `fromBooking()` | Builds CalendarEvent |
| 6 | `WebhookTaskConsumer.ts` | `buildDTO()` | Transforms to DTO |
| 6 | `dto/types.ts` | `BookingRescheduledDTO` | DTO type definition |
| 7 | `factory/base/BaseBookingPayloadBuilder.ts` | `BookingExtraDataMap` | Extra fields per trigger |
| 7 | `factory/versioned/v2021-10-20/BookingPayloadBuilder.ts` | `buildBookingPayload()` | Final payload structure |
| 8 | `service/WebhookService.ts` | `processWebhooks()` | HTTP delivery |

### Adding a New Field: Step-by-Step Guide

**Example: Adding `newField` to BOOKING_RESCHEDULED**

#### Step 1: Interface/Types (if field comes from queue)

**File:** `interface/WebhookProducerService.ts`
```typescript
export interface QueueBookingWebhookParams extends BaseQueueWebhookParams {
  // ... existing fields
  newField?: string;  // Add here if passed at queue time
}
```

**File:** `types/webhookTask.ts`
```typescript
export const bookingWebhookTaskPayloadSchema = baseWebhookTaskSchema.extend({
  // ... existing fields
  newField: z.string().optional(),  // Add to schema
});
```

#### Step 2: Producer (if field comes from queue)

**File:** `WebhookTaskerProducerService.ts`
```typescript
} else if (triggerEvent === WebhookTriggerEvents.BOOKING_RESCHEDULED) {
  taskPayload = {
    ...basePayload,
    triggerEvent,
    // ... existing reschedule fields
    newField: params.newField,  // Add here
  };
}
```

#### Step 3: DTO Type

**File:** `dto/types.ts`
```typescript
export interface BookingRescheduledDTO extends BaseEventDTO {
  // ... existing fields
  newField?: string;  // Add to DTO type
}
```

#### Step 4: Consumer (DTO Builder)

**File:** `WebhookTaskConsumer.ts` in `buildDTO()`
```typescript
case WebhookTriggerEvents.BOOKING_RESCHEDULED:
  return {
    ...baseDTO,
    triggerEvent,
    // ... existing fields
    newField: bookingPayload.newField,  // Map from task payload to DTO
  } as WebhookEventDTO;
```

#### Step 5: Extra Data Map (if field goes in payload)

**File:** `factory/base/BaseBookingPayloadBuilder.ts`
```typescript
[WebhookTriggerEvents.BOOKING_RESCHEDULED]: {
  // ... existing fields
  newField?: string;  // Add to extra data type
};
```

#### Step 6: Payload Builder

**File:** `factory/versioned/v2021-10-20/BookingPayloadBuilder.ts`
```typescript
case WebhookTriggerEvents.BOOKING_RESCHEDULED:
  return this.buildBookingPayload({
    // ... existing params
    extra: {
      // ... existing extra fields
      newField: dto.newField,  // Pass to extra
    },
  });
```

#### Step 7: Call Site (Entry Point)

**File:** `RegularBookingService.ts`
```typescript
await this.queueBookingRescheduledWebhook({
  // ... existing params
  newField: someValue,  // Pass the new field
});
```

### Field Sources Reference

| Field Type | Source | Example |
|------------|--------|---------|
| **Booking data** | `booking` object from DB | `bookingId`, `smsReminderNumber`, `assignmentReason` |
| **CalendarEvent** | Built via `CalendarEventBuilder` | `title`, `startTime`, `organizer`, `attendees`, `location` |
| **EventType info** | `booking.eventType` from DB | `eventTitle`, `eventDescription`, `price`, `currency`, `length` |
| **Trigger-specific** | Task payload from queue | `rescheduleId`, `rescheduleUid`, `cancelledBy`, `metadata` |
| **Platform** | Task payload (passed through CalendarEvent) | `platformClientId`, `platformRescheduleUrl` |
| **Computed** | PayloadBuilder | `utcOffset` (calculated from timezone) |

### Legacy Compatibility Notes

1. **assignmentReason**: Must be `[{ reasonEnum, reasonString }]` array format (from `booking.assignmentReason`), NOT `{ category, details }` object format
2. **eventTitle vs title**: `eventTitle` is the event TYPE's title, `title` is the booking's display title - both must be present
3. **additionalNotes & description**: Both must be present in payload, even if empty strings
4. **price defaults**: Default to `0` and `"usd"` for currency if not set

---

## DI Compliance & SOLID Assessment

### Current DI Compliance: **70%**

| Aspect | Status | Score | Notes |
|--------|--------|-------|-------|
| **D**ependency Inversion | ✅ Excellent | 95% | All services depend on abstractions (interfaces) |
| **I**nterface Segregation | ✅ Good | 85% | Interfaces well-segregated (`IWebhookService`, `IBookingWebhookService`, etc.) |
| **S**ingle Responsibility | ✅ Good | 90% | Each service has clear, focused responsibility |
| **O**pen/Closed | ✅ Good | 85% | Payload builders use versioning/registry pattern |
| **L**iskov Substitution | ✅ Good | 90% | Implementations properly substitute interfaces |
| **Composition Root** | ❌ Poor | 20% | Container exists but not used in production |
| **Explicit Dependencies** | ✅ Excellent | 95% | All dependencies explicit in constructors |
| **Lifecycle Management** | ⚠️  Fair | 60% | Container manages lifecycle but not used |

### Detailed SOLID Analysis

#### ✅ **Single Responsibility Principle** - COMPLIANT

Each service has one clear purpose:

- `WebhookService`: Webhook delivery & scheduling
- `BookingWebhookService`: Booking-specific webhook orchestration
- `FormWebhookService`: Form submission webhook orchestration
- `RecordingWebhookService`: Recording webhook orchestration
- `OOOWebhookService`: Out-of-office webhook orchestration
- `WebhookNotifier`: Notification dispatch
- `WebhookNotificationHandler`: Notification processing
- `WebhookRepository`: Data access

**Score: 9/10** - Well-designed service boundaries.

#### ✅ **Open/Closed Principle** - COMPLIANT

**Extensibility without modification**:

```typescript
// Payload versioning via Factory + Registry pattern
export const createPayloadBuilderFactory = (): PayloadBuilderFactory => {
  return new PayloadBuilderFactory(payloadBuilderRegistry);
};

// New versions can be added without modifying existing code
payloadBuilderRegistry.register("2021-10-20", {
  booking: BookingPayloadBuilderV20211020,
  form: FormPayloadBuilderV20211020,
  // ...
});
```

**Score: 8.5/10** - Good extensibility via factory/registry pattern.

#### ✅ **Liskov Substitution Principle** - COMPLIANT

All implementations properly substitute their interfaces:

```typescript
// Interface
export interface IWebhookRepository {
  getSubscribers(options: GetSubscribersOptions): Promise<WebhookSubscriber[]>;
}

// Implementation - fully compatible
export class WebhookRepository implements IWebhookRepository {
  async getSubscribers(options: GetSubscribersOptions): Promise<WebhookSubscriber[]> {
    // Implementation matches interface contract
  }
}
```

**Score: 9/10** - Proper substitutability throughout.

#### ✅ **Interface Segregation Principle** - COMPLIANT

Interfaces are well-segregated:

```typescript
// Core interfaces separated by concern
export interface IWebhookRepository { /* Data access */ }
export interface IWebhookProcessor { /* Processing */ }
export interface IWebhookScheduler { /* Scheduling */ }

// Event-specific interfaces
export interface IBookingEventEmitter { /* Booking events */ }
export interface IFormEventEmitter { /* Form events */ }

// Infrastructure
export interface ITasker { /* Task scheduling */ }
export interface ILogger { /* Logging */ }
```

**Score: 8.5/10** - Clean interface separation. Backward-compat combined interfaces (`IWebhookService`) could be deprecated.

#### ✅ **Dependency Inversion Principle** - COMPLIANT

All services depend on abstractions:

```typescript
// HIGH-LEVEL MODULE
export class BookingWebhookService implements IBookingWebhookService {
  constructor(
    private readonly webhookNotifier: IWebhookNotifier,     // ← Interface
    private readonly webhookService: IWebhookService,       // ← Interface
    private readonly tasker: ITasker,                       // ← Interface
    logger: ILogger                                         // ← Interface
  ) {}
}
```

**Score: 9.5/10** - Excellent dependency inversion. Only minor issue: `WebhookRepository` has default Prisma parameter.

### Critical Gap: Composition Root

**Current State**: ❌ **MAJOR DI VIOLATION**

The composition root (DI container) exists but is **never used in production**. Instead, production code uses:

```typescript
// ❌ This bypasses DI entirely
import getWebhooks from "@calcom/features/webhooks/lib/getWebhooks";
const subscribers = await getWebhooks(options);
```

**What It Should Be**:

```typescript
// ✅ Using DI container
import { getWebhookFeature } from "@calcom/features/di/webhooks/containers/webhook";
const webhooks = await getWebhookFeature();
await webhooks.booking.emitBookingCreated(params);
```

**Impact**: The entire DI infrastructure is **scaffolding without integration**.

---

## Working Implementation vs Scaffolding

### Architecture Comparison

#### Current Production Pattern (No DI)

```
User Code
    ↓
getWebhooks() → WebhookRepository.getInstance() → Prisma
    ↓
sendPayload() → fetch() / tasker
```

**Characteristics**:
- ❌ Direct function calls
- ❌ Singleton pattern for repository
- ❌ Hard to test (global state)
- ❌ No dependency injection
- ✅ Works reliably in production
- ✅ Simple to use

#### DI Scaffolding Pattern (Unused)

```
User Code (none!)
    ↓
[Container]
    ↓
WebhookService → IWebhookRepository → Prisma (not wired!)
    ↓          ↓
BookingWebhookService → IWebhookNotifier
    ↓
ITasker, ILogger
```

**Characteristics**:
- ✅ Proper dependency injection
- ✅ Interface-based
- ✅ Easy to test
- ✅ Lifecycle management
- ❌ Not connected to Prisma
- ❌ No production usage
- ❌ No facade for ease of use

#### Target Architecture (After Wiring)

```
User Code
    ↓
getWebhookFeature() → WebhookFeature facade
    ↓                       ↓
[Container]         booking.emitBookingCreated()
    ↓                       ↓
BookingWebhookService → WebhookService → WebhookRepository → Prisma (DI)
    ↓                       ↓
WebhookNotifier      ITasker, ILogger
```

**Benefits**:
- ✅ Proper DI with Prisma integration
- ✅ Easy-to-use facade API
- ✅ Fully testable
- ✅ Managed lifecycle
- ✅ Production-ready

### Interface Alignment

**Good News**: The working implementation and DI scaffolding use **the same classes**!

```typescript
// DI Module binds this class:
webhookModule.bind(WEBHOOK_TOKENS.BOOKING_WEBHOOK_SERVICE)
  .toClass(BookingWebhookService, [...]);

// This is the same class used in working code:
import { BookingWebhookService } from "@calcom/features/webhooks/lib/service/BookingWebhookService";
```

**This means**: We don't need to rewrite services, just wire them properly and migrate usage.

---

## Wiring Phase Plan

The wiring phase connects the DI scaffolding to production by:

1. **Integrating infrastructure dependencies** (Prisma)
2. **Creating the facade layer** for ease of use
3. **Building the operations layer** for high-level use cases
4. **Migrating production code** to use DI
5. **Removing legacy patterns** (singletons, direct instantiation)

### Phase 1: Infrastructure Integration

**Goal**: Connect container to infrastructure services (Prisma, Logger, Tasker)

#### Task 1.1: Integrate Prisma Module

**File**: `packages/features/di/webhooks/containers/webhook.ts`

**Changes**:

```typescript
// ADD: Import Prisma module loader
import { moduleLoader as prismaModuleLoader } from "@calcom/features/di/modules/Prisma";

export const webhookContainer = createContainer();

// ADD: Load Prisma module FIRST
prismaModuleLoader.loadModule(webhookContainer);

// Then load other modules...
loggerModuleLoader.loadModule(webhookContainer);
webhookContainer.load(SHARED_TOKENS.TASKER, taskerServiceModule);
```

**File**: `packages/features/di/webhooks/modules/Webhook.module.ts`

**Changes**:

```typescript
import { DI_TOKENS } from "@calcom/features/di/tokens";

// UPDATE: Bind repository with Prisma dependency
webhookModule
  .bind(WEBHOOK_TOKENS.WEBHOOK_REPOSITORY)
  .toClass(WebhookRepository, [DI_TOKENS.PRISMA_CLIENT]);
```

**File**: `packages/features/webhooks/lib/repository/WebhookRepository.ts`

**Changes**:

```typescript
// REMOVE: Default parameter and singleton
export class WebhookRepository implements IWebhookRepository {
  constructor(private readonly prisma: PrismaClient) {} // No default!
  
  // REMOVE: getInstance() method entirely
  
  // Keep all other methods...
}
```

**Testing**:

```typescript
// Verify Prisma is injected
const repo = webhookContainer.get<IWebhookRepository>(WEBHOOK_TOKENS.WEBHOOK_REPOSITORY);
// Should work without errors
```

#### Task 1.2: Export Tokens to Main DI_TOKENS

**File**: `packages/features/di/webhooks/Webhooks.tokens.ts`

**Changes**:

```typescript
export const WEBHOOK_TOKENS = { 
  // Core interfaces
  WEBHOOK_SERVICE: Symbol("IWebhookService"),
  BOOKING_WEBHOOK_SERVICE: Symbol("IBookingWebhookService"),
  FORM_WEBHOOK_SERVICE: Symbol("IFormWebhookService"),
  RECORDING_WEBHOOK_SERVICE: Symbol("IRecordingWebhookService"),
  OOO_WEBHOOK_SERVICE: Symbol("OOO_WEBHOOK_SERVICE"),
  WEBHOOK_NOTIFIER: Symbol("IWebhookNotifier"),
  WEBHOOK_NOTIFICATION_HANDLER: Symbol("WebhookNotificationHandler"),
  PAYLOAD_BUILDER_FACTORY: Symbol("PayloadBuilderFactory"),
  WEBHOOK_REPOSITORY: Symbol("IWebhookRepository"),
} as const;

```

**File**: `packages/features/di/tokens.ts`

**Changes**:

```typescript
import { WEBHOOK_TOKENS } from "./webhooks/Webhooks.tokens";

export const DI_TOKENS = {
  // ... existing tokens
  ...WEBHOOK_TOKENS,
};
```

#### Task 1.3: Remove Duplicate Files

**Delete**:
- `/packages/features/di/webhooks/repositories/Webhook.repository.ts`
- `/packages/features/di/webhooks/services/Webhook.service.ts`

**Keep directories** for consistency (empty is fine).

**Update imports**: Ensure no files import from these deleted files.

### Phase 2: Facade Creation

**Goal**: Create a unified `WebhookFeature` facade following the watchlist pattern.

#### Task 2.1: Create WebhookFeature Interface

**File**: `packages/features/webhooks/lib/facade/WebhookFeature.ts` (NEW)

```typescript
import type { Container } from "@evyweb/ioctopus";

import { WEBHOOK_TOKENS } from "@calcom/features/di/webhooks/Webhooks.tokens";
import logger from "@calcom/lib/logger";

import type {
  IWebhookService,
  IBookingWebhookService,
  IFormWebhookService,
  IRecordingWebhookService,
} from "../interface/services";
import type { IWebhookRepository } from "../interface/IWebhookRepository";
import type { IWebhookNotifier } from "../interface/infrastructure";
import type { OOOWebhookService } from "../service/OOOWebhookService";

/**
 * WebhookFeature - Unified facade for all webhook operations.
 * 
 * This facade provides a single entry point for webhook functionality,
 * grouping related services by domain.
 */
export interface WebhookFeature {
  /** Core webhook management service */
  core: IWebhookService;
  
  /** Booking-related webhook operations */
  booking: IBookingWebhookService;
  
  /** Form submission webhook operations */
  form: IFormWebhookService;
  
  /** Recording webhook operations */
  recording: IRecordingWebhookService;
  
  /** Out-of-office webhook operations */
  ooo: OOOWebhookService;
  
  /** Low-level notification dispatch */
  notifier: IWebhookNotifier;
  
  /** Direct repository access (use sparingly) */
  repository: IWebhookRepository;
}

/**
 * Factory function to create WebhookFeature from DI container.
 * 
 * @param container - DI container with webhook services loaded
 * @returns WebhookFeature facade
 */
export function createWebhookFeature(container: Container): WebhookFeature {
  return {
    core: container.get<IWebhookService>(WEBHOOK_TOKENS.WEBHOOK_SERVICE),
    booking: container.get<IBookingWebhookService>(WEBHOOK_TOKENS.BOOKING_WEBHOOK_SERVICE),
    form: container.get<IFormWebhookService>(WEBHOOK_TOKENS.FORM_WEBHOOK_SERVICE),
    recording: container.get<IRecordingWebhookService>(WEBHOOK_TOKENS.RECORDING_WEBHOOK_SERVICE),
    ooo: container.get<OOOWebhookService>(WEBHOOK_TOKENS.OOO_WEBHOOK_SERVICE),
    notifier: container.get<IWebhookNotifier>(WEBHOOK_TOKENS.WEBHOOK_NOTIFIER),
    repository: container.get<IWebhookRepository>(WEBHOOK_TOKENS.WEBHOOK_REPOSITORY),
  };
}
```

#### Task 2.2: Update Container to Export Facade

**File**: `packages/features/di/webhooks/containers/webhook.ts`

**Changes**:

```typescript
import { createWebhookFeature, type WebhookFeature } from "@calcom/features/webhooks/lib/facade/WebhookFeature";
import type { IWebhookService, IBookingWebhookService, IFormWebhookService, IRecordingWebhookService } from "@calcom/features/webhooks/lib/interface/services";
import type { IWebhookNotifier } from "@calcom/features/webhooks/lib/interface/infrastructure";
import type { OOOWebhookService } from "@calcom/features/webhooks/lib/service/OOOWebhookService";

// ... existing container setup ...

// ============================================================================
// PRIMARY EXPORT - Use this in new code
// ============================================================================

/**
 * Get the complete WebhookFeature facade.
 * 
 * @example
 * const webhooks = await getWebhookFeature();
 * await webhooks.booking.emitBookingCreated(params);
 */
export async function getWebhookFeature(): Promise<WebhookFeature> {
  return createWebhookFeature(webhookContainer);
}

// ============================================================================
// INDIVIDUAL GETTERS - Kept for backward compatibility
// Prefer getWebhookFeature() for new code
// ============================================================================

export function getBookingWebhookService() {
  return webhookContainer.get<IBookingWebhookService>(WEBHOOK_TOKENS.BOOKING_WEBHOOK_SERVICE);
}

export function getFormWebhookService() {
  return webhookContainer.get<IFormWebhookService>(WEBHOOK_TOKENS.FORM_WEBHOOK_SERVICE);
}

export function getRecordingWebhookService() {
  return webhookContainer.get<IRecordingWebhookService>(WEBHOOK_TOKENS.RECORDING_WEBHOOK_SERVICE);
}

export function getOOOWebhookService() {
  return webhookContainer.get<OOOWebhookService>(WEBHOOK_TOKENS.OOO_WEBHOOK_SERVICE);
}

export function getWebhookNotifier() {
  return webhookContainer.get<IWebhookNotifier>(WEBHOOK_TOKENS.WEBHOOK_NOTIFIER);
}

export function getWebhookService() {
  return webhookContainer.get<IWebhookService>(WEBHOOK_TOKENS.WEBHOOK_SERVICE);
}

export function getWebhookRepository() {
  return webhookContainer.get<IWebhookRepository>(WEBHOOK_TOKENS.WEBHOOK_REPOSITORY);
}
```

### Phase 3: Operations Layer

**Goal**: Create controller/operation layer for common webhook use cases.

#### Task 3.1: Create Send Booking Webhook Controller

**File**: `packages/features/webhooks/operations/send-booking-webhook.controller.ts` (NEW)

```typescript
import { getWebhookFeature } from "@calcom/features/di/webhooks/containers/webhook";
import logger from "@calcom/lib/logger";

import type { BookingCreatedParams } from "../lib/types/params";
import type { SpanFn } from "../lib/telemetry";

interface SendBookingWebhookParams extends BookingCreatedParams {
  span?: SpanFn;
}

/**
 * High-level operation for sending booking created webhooks.
 * 
 * Handles orchestration, error handling, and telemetry.
 */
export async function sendBookingCreatedWebhookController(
  params: SendBookingWebhookParams
): Promise<void> {
  const { span, ...webhookParams } = params;
  
  const execute = async () => {
    try {
      const webhooks = await getWebhookFeature();
      await webhooks.booking.emitBookingCreated(webhookParams);
    } catch (error) {
      logger.error("Failed to send booking created webhook", {
        bookingId: params.booking.id,
        error,
      });
      throw error;
    }
  };
  
  if (!span) {
    return execute();
  }
  
  return span({ name: "sendBookingCreatedWebhook" }, execute);
}
```

**Additional controllers to create**:
- `send-booking-cancelled-webhook.controller.ts`
- `send-booking-rescheduled-webhook.controller.ts`
- `send-form-submitted-webhook.controller.ts`
- `send-recording-ready-webhook.controller.ts`

#### Task 3.2: Create Tests for Operations

**File**: `packages/features/webhooks/operations/send-booking-webhook.controller.test.ts` (NEW)

```typescript
import { vi, describe, test, expect, beforeEach } from "vitest";

import type { WebhookFeature } from "../lib/facade/WebhookFeature";

vi.mock("@calcom/features/di/webhooks/containers/webhook", () => ({
  getWebhookFeature: vi.fn(),
}));

const mockBookingWebhookService = {
  emitBookingCreated: vi.fn(),
  emitBookingCancelled: vi.fn(),
  // ... other methods
};

const mockWebhookFeature: WebhookFeature = {
  booking: mockBookingWebhookService,
  // ... other services
} as any;

describe("sendBookingCreatedWebhookController", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { getWebhookFeature } = await import("@calcom/features/di/webhooks/containers/webhook");
    vi.mocked(getWebhookFeature).mockResolvedValue(mockWebhookFeature);
  });
  
  test("should call booking webhook service", async () => {
    const { sendBookingCreatedWebhookController } = await import("./send-booking-webhook.controller");
    
    await sendBookingCreatedWebhookController({
      booking: { id: 123 } as any,
      eventType: {} as any,
      triggerEvent: "BOOKING_CREATED",
    });
    
    expect(mockBookingWebhookService.emitBookingCreated).toHaveBeenCalledWith({
      booking: { id: 123 },
      eventType: {},
      triggerEvent: "BOOKING_CREATED",
    });
  });
});
```

### Phase 4: Migration of Existing Usage

**Goal**: Migrate production code from direct functions to DI-based services.

#### Current Usage Patterns to Replace

**Pattern 1: Direct `getWebhooks` + `sendPayload`**

```typescript
// ❌ BEFORE (Current production code)
import getWebhooks from "@calcom/features/webhooks/lib/getWebhooks";
import sendPayload from "@calcom/features/webhooks/lib/sendOrSchedulePayload";

const subscribers = await getWebhooks({
  userId,
  eventTypeId,
  triggerEvent: "BOOKING_CREATED",
  teamId,
});

await Promise.all(
  subscribers.map((sub) =>
    sendPayload(sub.secret, triggerEvent, new Date().toISOString(), sub, webhookData)
  )
);
```

```typescript
// ✅ AFTER (Using DI + operations)
import { sendBookingCreatedWebhookController } from "@calcom/features/webhooks/operations/send-booking-webhook.controller";

await sendBookingCreatedWebhookController({
  booking,
  eventType,
  triggerEvent: "BOOKING_CREATED",
});
```

**Pattern 2: `handleWebhookTrigger` helper**

```typescript
// ❌ BEFORE
import { handleWebhookTrigger } from "@calcom/features/bookings/lib/handleWebhookTrigger";

await handleWebhookTrigger({
  subscriberOptions: { userId, eventTypeId, triggerEvent: "BOOKING_CREATED", teamId },
  eventTrigger: "BOOKING_CREATED",
  webhookData: { /* booking data */ },
});
```

```typescript
// ✅ AFTER
import { sendBookingCreatedWebhookController } from "@calcom/features/webhooks/operations/send-booking-webhook.controller";

await sendBookingCreatedWebhookController({
  booking,
  eventType,
  triggerEvent: "BOOKING_CREATED",
});
```

#### Migration Priority

**High Priority** (25+ files):
1. `packages/features/bookings/lib/handleWebhookTrigger.ts` - Central orchestration
2. `packages/features/bookings/lib/handleConfirmation.ts` - Booking confirmation
3. `packages/features/bookings/lib/handleCancelBooking.ts` - Booking cancellation
4. `packages/app-store/routing-forms/lib/formSubmissionUtils.ts` - Form webhooks
5. `packages/trpc/server/routers/viewer/ooo/outOfOfficeCreateOrUpdate.handler.ts` - OOO webhooks

**Medium Priority**:
- TRPC handlers
- Tasker job handlers
- Test files

**Low Priority**:
- Developer utilities
- CLI tools

#### Migration Strategy Per File

1. **Identify webhook usage** (search for `sendPayload`, `getWebhooks`)
2. **Determine operation** (booking created, form submitted, etc.)
3. **Replace with controller** from operations layer
4. **Update imports**
5. **Test thoroughly**
6. **Mark legacy functions as deprecated** (in JSDoc)

### Phase 5: Deprecation & Cleanup

**Goal**: Mark old patterns as deprecated and clean up after migration.

#### Task 5.1: Deprecate Legacy Functions

**File**: `packages/features/webhooks/lib/getWebhooks.ts`

```typescript
/**
 * Get webhook subscribers for an event.
 * 
 * @deprecated Use DI-based services instead:
 * ```
 * const webhooks = await getWebhookFeature();
 * const subscribers = await webhooks.repository.getSubscribers(options);
 * ```
 */
const getWebhooks = async (/* ... */) => {
  // ... existing implementation
};
```

**File**: `packages/features/webhooks/lib/sendPayload.ts`

```typescript
/**
 * Send webhook payload to subscriber.
 * 
 * @deprecated Use DI-based services instead:
 * ```
 * const webhooks = await getWebhookFeature();
 * await webhooks.booking.emitBookingCreated(params);
 * ```
 */
const sendPayload = async (/* ... */) => {
  // ... existing implementation
};
```

#### Task 5.2: Add Runtime Warnings

```typescript
// In deprecated functions, add:
if (process.env.NODE_ENV !== "production") {
  logger.warn("getWebhooks() is deprecated. Use getWebhookFeature() instead.");
}
```

#### Task 5.3: Remove After Deprecation Period

**Timeline**: 6 months after full migration

- Remove `getWebhooks.ts`
- Remove `sendPayload.ts`
- Remove `sendOrSchedulePayload.ts`
- Remove `handleWebhookTrigger.ts` (move logic to operations)

---

## Implementation Roadmap

The implementation is organized into 7 phases, aligned with GitHub issues:

- **Phase 0**: Infrastructure (prerequisite for all other phases)
- **Phase 1**: Core BookingWebhookService (#23238)
- **Phase 2**: NoShow + Remaining BookingWebhookService (#23239)
- **Phase 3**: OOOWebhookService (#23240)
- **Phase 4**: FormWebhookService (#23241)
- **Phase 5**: RecordingWebhookService (#23242)
- **Phase 6**: Clean up Legacy Code (#23243)

---

### Phase 0: Infrastructure Setup (Prerequisite)

**GitHub Issue**: N/A (prerequisite for all issues)  
**Goal**: Wire infrastructure dependencies, create Producer/Consumer pattern, and facade/operations foundation

**Architecture Decision**: Adopt Producer/Consumer pattern (mirroring Booking Audit architecture) where:
- **Producer** (lightweight): Queues webhook tasks via Tasker
- **Consumer** (heavy): Processes webhook tasks (will be deployed to trigger.dev)
- No coexistence pattern - single path through queue system

**Tasks**:

#### 0.1: Prisma Integration
- [x] Import `prismaModuleLoader` in webhook container
- [x] Add `prismaModuleLoader.loadModule(webhookContainer)` before other modules
- [x] Update `WebhookRepository` binding to include `[DI_TOKENS.PRISMA_CLIENT]`
- [x] Keep default parameter in `WebhookRepository` constructor (removed in Phase 1.1)
- [x] Keep `getInstance()` singleton method (removed in Phase 1.1)

#### 0.2: Producer/Consumer Pattern - Interfaces & Types

**Create Producer Interface:**
- [x] Create `/packages/features/webhooks/lib/interface/WebhookProducerService.ts`
- [x] Define `IWebhookProducerService` interface with queue methods for all webhook events

**Create Task Payload Types:**
- [x] Create `/packages/features/webhooks/lib/types/webhookTask.ts`
- [x] Define `WebhookTaskPayload` type with Zod schema
- [x] Include all required fields for task processing

#### 0.3: Producer Implementation

**Create Producer Service:**
- [x] Create `/packages/features/webhooks/lib/service/WebhookTaskerProducerService.ts`
- [x] Implement `IWebhookProducerService` interface
- [x] Constructor deps: `ITasker`, `ILogger` only
- [x] All methods queue tasks via Tasker
- [x] Generate `operationId` with fallback
- [x] Proper logging and error handling

**Create Producer Module:**
- [x] Create `/packages/features/di/webhooks/modules/WebhookProducerService.module.ts`
- [x] Bind service with correct dependencies

**Create Producer Container:**
- [x] Integrated into main webhook container
- [x] Export `getWebhookProducerService()` function

#### 0.4: Consumer Implementation

**Create Consumer Service:**
- [x] Create `/packages/features/webhooks/lib/service/WebhookTaskConsumer.ts`
- [x] Implement task processing scaffolding
- [x] Constructor deps: `IWebhookRepository`, `ILogger`
- [x] Add method: `processWebhookTask(payload, taskId)`
- [x] Proper error handling and logging
- [ ] Full data fetching implementation (Phase 1+)
- [ ] PayloadBuilder integration (Phase 1+)

**Create Consumer Module:**
- [x] Create `/packages/features/di/webhooks/modules/WebhookTaskConsumer.module.ts`
- [x] Bind service with correct dependencies

**Create Consumer Container:**
- [x] Integrated into main webhook container
- [x] Export `getWebhookTaskConsumer()` function

#### 0.5: Token Integration

**Update Tokens:**
- [x] Add Producer/Consumer tokens to `Webhooks.tokens.ts`
- [x] Keep `WEBHOOK_TOKENS` name (no rename needed)
- [x] Import `WEBHOOK_TOKENS` in `/packages/features/di/tokens.ts`
- [x] Add `...WEBHOOK_TOKENS` to main `DI_TOKENS` object

#### 0.6: Main Container Integration

**Update Main Webhook Container:**
- [x] Load producer and consumer modules
- [x] Keep existing service bindings for backward compatibility
- [x] All services accessible via facade

#### 0.7: File Cleanup
- [x] No duplicate files exist (verified)

#### 0.8: Facade Pattern

**Create Facade Interface:**
- [x] Create `/packages/features/webhooks/lib/facade/WebhookFeature.ts`
- [x] Define `WebhookFeature` interface with all services
- [x] Export `getWebhookFeature()` from container
- [x] Add proper type annotations to all getters

**Add Individual Getters:**
- [x] Export `getWebhookProducerService()` from main container
- [x] Export `getWebhookTaskConsumer()` from main container

#### 0.9: Payload Compatibility Validation ⚠️ CRITICAL

**Validation Process:**

1. **Create Payload Comparison Tests:**
   - [x] Create `/packages/features/webhooks/lib/service/__tests__/payload-compatibility.test.ts`
   - [x] Create test fixtures in `__tests__/fixtures.ts`
   - [x] Create test infrastructure
   - [ ] Full implementation when Consumer is wired (Phase 1+)

2. **Events to Validate (Scaffolded):**
   - [x] `BOOKING_CREATED` - Test scaffold ready
   - [x] `BOOKING_CANCELLED` - Test scaffold ready
   - [x] `BOOKING_RESCHEDULED` - Test scaffold ready
   - [x] `BOOKING_CONFIRMED` - Test scaffold ready
   - [x] `BOOKING_REJECTED` - Test scaffold ready
   - [x] `BOOKING_PAYMENT_INITIATED` - Test scaffold ready
   - [x] `BOOKING_PAID` - Test scaffold ready
   - [x] `BOOKING_NO_SHOW_UPDATED` - Test scaffold ready
   - [x] `FORM_SUBMITTED` - Test scaffold ready
   - [x] `RECORDING_READY` - Test scaffold ready
   - [x] `OOO_CREATED` - Test scaffold ready

3. **Validation Criteria:**
   - [ ] All required fields present in both payloads
   - [ ] Field types match exactly
   - [ ] Field values match (use test fixtures)
   - [ ] Nested objects structure matches
   - [ ] Array ordering matches (if order matters)
   - [ ] Version field handled correctly
   - [ ] No missing fields
   - [ ] No extra fields (unless intentionally added)

4. **Test Implementation Example:**
   ```typescript
   describe("Payload Compatibility", () => {
     it("BOOKING_CREATED payload matches current implementation", async () => {
       const testBooking = createTestBooking();
       const testEventType = createTestEventType();
       
       // Current implementation
       const currentPayload = await getCurrentBookingCreatedPayload(testBooking, testEventType);
       
       // New Producer/Consumer
       const newPayload = await getProducerConsumerBookingCreatedPayload(testBooking, testEventType);
       
       // Compare (excluding timestamp, operationId)
       expect(newPayload).toMatchObject(omit(currentPayload, ["timestamp", "operationId"]));
       
       // Verify all expected fields exist
       expect(newPayload).toHaveProperty("triggerEvent", "BOOKING_CREATED");
       expect(newPayload).toHaveProperty("booking");
       expect(newPayload).toHaveProperty("eventType");
       // ... verify all required fields
     });
   });
   ```

5. **Documentation:**
   - [ ] Document any intentional payload differences
   - [ ] Document version changes (if any)
   - [ ] Create payload migration guide if changes needed

**⚠️ BLOCKER:** Phase 0 cannot proceed to wiring until **ALL** payload validation tests pass.

**Files:**
- `/packages/features/webhooks/lib/service/__tests__/payload-compatibility.test.ts` (new)
- `/packages/features/webhooks/lib/service/__tests__/fixtures.ts` (new - test data)

#### 0.10: Testing Infrastructure

**Producer Tests:**
- [x] Write unit tests for `WebhookTaskerProducerService`
- [x] Test all queue methods
- [x] Test operationId generation
- [x] Test error handling
- [x] Mock Tasker and Logger

**Consumer Tests:**
- [x] Write unit tests for `WebhookTaskConsumer`
- [x] Test basic processing flow
- [x] Test subscriber fetching
- [x] Test error handling
- [ ] Test full data fetching (Phase 1+)

**Task Handler:**
- [x] Create `/packages/features/tasker/tasks/webhookDelivery.ts`
- [x] Register in tasker with retry logic
- [x] Integration with Consumer service
- [ ] Write unit tests for `WebhookTaskConsumer`
- [ ] Test payload parsing
- [ ] Test subscriber fetching
- [ ] Test payload building
- [ ] Test webhook sending
- [ ] Mock all dependencies

**Integration Tests:**
- [ ] Test producer → tasker → consumer flow
- [ ] Test with real task queue (in-memory)
- [ ] Verify end-to-end webhook delivery

**Container Tests:**
- [ ] Verify all services resolvable
- [ ] Verify Prisma injection works
- [ ] Verify producer/consumer accessible
- [ ] Test facade returns all services

#### 0.11: Tasker Task Handler Registration

**Register Webhook Task Handler:**
- [ ] Create `/packages/features/tasker/tasks/webhookDelivery.ts`
- [ ] Register task type: `"webhookDelivery"`
- [ ] Handler calls `getWebhookTaskConsumer().processWebhookTask(payload, taskId)`
- [ ] Add to tasker task registry

**Files Changed**:
- `packages/features/di/webhooks/containers/webhook.ts` (updated)
- `packages/features/di/webhooks/containers/WebhookProducerService.container.ts` (new)
- `packages/features/di/webhooks/containers/WebhookTaskConsumer.container.ts` (new)
- `packages/features/di/webhooks/modules/Webhook.module.ts` (updated)
- `packages/features/di/webhooks/modules/WebhookProducerService.module.ts` (new)
- `packages/features/di/webhooks/modules/WebhookTaskConsumer.module.ts` (new)
- `packages/features/di/webhooks/Webhooks.tokens.ts` (updated)
- `packages/features/di/tokens.ts` (updated)
- `packages/features/webhooks/lib/repository/WebhookRepository.ts` (updated)
- `packages/features/webhooks/lib/service/WebhookProducerService.interface.ts` (new)
- `packages/features/webhooks/lib/service/WebhookTaskerProducerService.ts` (new)
- `packages/features/webhooks/lib/service/WebhookTaskConsumer.ts` (new)
- `packages/features/webhooks/lib/types/webhookTask.ts` (new)
- `packages/features/webhooks/lib/facade/WebhookFeature.ts` (new)
- `packages/features/tasker/tasks/webhookDelivery.ts` (new)

**Success Criteria**:
- ✅ All services resolvable from container
- ✅ Prisma injected via DI (no default parameter, no singleton)
- ✅ `WEBHOOK_TOKENS` in main `DI_TOKENS`
- ✅ `getWebhookFeature()` returns working facade with producer/consumer
- ✅ `getWebhookProducerService()` returns producer service
- ✅ No duplicate files in DI folder
- ✅ Producer can queue webhook tasks
- ✅ Consumer can process webhook tasks
- ✅ **⚠️ ALL payload compatibility tests pass** (current vs new implementation)
- ✅ Tasker handler registered for "webhookDelivery"
- ✅ All tests passing (unit + integration + payload validation)
- ✅ Type checks pass: `yarn type-check:ci --force`

**Estimated Time**: 5-7 days (increased from 3-4 days due to Producer/Consumer implementation + payload validation)

---

### Phase 1: Core BookingWebhookService (#23238)

**GitHub Issue**: #23238  
**Goal**: Migrate core booking webhook usage (created, cancelled, rescheduled, confirmed)

**Scope**:
- Booking created webhooks
- Booking cancelled webhooks
- Booking rescheduled webhooks
- Booking confirmed webhooks
- Payment-related webhooks (initiated, paid)

**Tasks**:

#### 1.1: Create Operations Layer
- [ ] Create `/packages/features/webhooks/operations/send-booking-created-webhook.controller.ts`
- [ ] Create `/packages/features/webhooks/operations/send-booking-cancelled-webhook.controller.ts`
- [ ] Create `/packages/features/webhooks/operations/send-booking-rescheduled-webhook.controller.ts`
- [ ] Create `/packages/features/webhooks/operations/send-booking-confirmed-webhook.controller.ts`
- [ ] Create `/packages/features/webhooks/operations/send-booking-payment-webhook.controller.ts`
- [ ] Write comprehensive tests for each operation

#### 1.2: Migrate Core Booking Files
- [ ] Migrate `packages/features/bookings/lib/handleWebhookTrigger.ts`
- [ ] Migrate `packages/features/bookings/lib/handleConfirmation.ts`
- [ ] Migrate `packages/features/bookings/lib/handleCancelBooking.ts`
- [ ] Migrate `packages/features/bookings/lib/handleBookingRequested.ts`
- [ ] Migrate `packages/features/bookings/lib/service/RegularBookingService.ts`
- [ ] Migrate `packages/features/bookings/lib/service/InstantBookingCreateService.ts`
- [ ] Update tests for migrated files

#### 1.3: Migrate TRPC Handlers
- [ ] Migrate `packages/trpc/server/routers/viewer/bookings/confirm.handler.ts`
- [ ] Migrate `packages/trpc/server/routers/viewer/bookings/requestReschedule.handler.ts`
- [ ] Migrate related booking TRPC handlers
- [ ] Update tests

#### 1.4: Migrate Seats Handling
- [ ] Migrate `packages/features/bookings/lib/handleSeats/handleSeats.ts`
- [ ] Migrate `packages/features/bookings/lib/handleSeats/cancel/cancelAttendeeSeat.ts`
- [ ] Update tests

**Files to Migrate** (~10-12 files):
- `packages/features/bookings/lib/handleWebhookTrigger.ts`
- `packages/features/bookings/lib/handleConfirmation.ts`
- `packages/features/bookings/lib/handleCancelBooking.ts`
- `packages/features/bookings/lib/handleBookingRequested.ts`
- `packages/features/bookings/lib/service/RegularBookingService.ts`
- `packages/features/bookings/lib/service/InstantBookingCreateService.ts`
- `packages/features/bookings/lib/handleSeats/handleSeats.ts`
- `packages/features/bookings/lib/handleSeats/cancel/cancelAttendeeSeat.ts`
- `packages/trpc/server/routers/viewer/bookings/confirm.handler.ts`
- `packages/trpc/server/routers/viewer/bookings/requestReschedule.handler.ts`

**Migration Pattern**:

```typescript
// BEFORE
import getWebhooks from "@calcom/features/webhooks/lib/getWebhooks";
import sendPayload from "@calcom/features/webhooks/lib/sendOrSchedulePayload";

const subscribers = await getWebhooks({ userId, eventTypeId, triggerEvent: "BOOKING_CREATED" });
await Promise.all(subscribers.map(sub => sendPayload(...)));

// AFTER
import { sendBookingCreatedWebhookController } from "@calcom/features/webhooks/operations/send-booking-created-webhook.controller";

await sendBookingCreatedWebhookController({
  booking,
  eventType,
  triggerEvent: "BOOKING_CREATED",
  span,
});
```

**Success Criteria**:
- ✅ All core booking webhook operations implemented
- ✅ 10-12 files migrated to use DI
- ✅ All tests passing (unit + integration)
- ✅ Booking webhooks work in staging
- ✅ No production issues
- ✅ Webhook metrics unchanged

**Estimated Time**: 1 week

---

### Phase 2: NoShow + Remaining BookingWebhookService (#23239)

**GitHub Issue**: #23239  
**Goal**: Migrate no-show webhooks and remaining booking-related webhook usage

**Scope**:
- No-show webhooks
- No-show scheduled triggers
- Booking rejection webhooks
- Any remaining booking webhook patterns

**Tasks**:

#### 2.1: Create NoShow Operations
- [ ] Create `/packages/features/webhooks/operations/send-booking-noshow-webhook.controller.ts`
- [ ] Create `/packages/features/webhooks/operations/schedule-noshow-webhook.controller.ts`
- [ ] Create `/packages/features/webhooks/operations/send-booking-rejected-webhook.controller.ts`
- [ ] Write tests for each operation

#### 2.2: Migrate NoShow Handling
- [ ] Migrate `packages/features/handleMarkNoShow.ts`
- [ ] Migrate `packages/features/bookings/lib/handleNewBooking/scheduleNoShowTriggers.ts`
- [ ] Migrate `packages/features/bookings/lib/handleNewBooking/scheduleNoShowTriggers.integration-test.ts`
- [ ] Update tests

#### 2.3: Migrate Tasker Jobs
- [ ] Migrate `packages/features/tasker/tasks/triggerNoShow/common.ts`
- [ ] Update related tasker job tests

#### 2.4: Migrate Daily Webhook Handler
- [ ] Migrate `apps/web/lib/daily-webhook/triggerWebhooks.ts`
- [ ] Update tests

**Files to Migrate** (~5-7 files):
- `packages/features/handleMarkNoShow.ts`
- `packages/features/bookings/lib/handleNewBooking/scheduleNoShowTriggers.ts`
- `packages/features/tasker/tasks/triggerNoShow/common.ts`
- `apps/web/lib/daily-webhook/triggerWebhooks.ts`

**Success Criteria**:
- ✅ NoShow operations implemented and tested
- ✅ 5-7 files migrated
- ✅ NoShow webhooks work in staging
- ✅ Scheduled no-show triggers work correctly
- ✅ All tests passing

**Estimated Time**: 3-4 days

---

### Phase 3: OOOWebhookService (#23240)

**GitHub Issue**: #23240  
**Goal**: Migrate out-of-office (OOO) webhook usage

**Scope**:
- OOO entry created webhooks
- OOO entry deleted webhooks
- OOO-related webhook handling

**Tasks**:

#### 3.1: Create OOO Operations
- [ ] Create `/packages/features/webhooks/operations/send-ooo-created-webhook.controller.ts`
- [ ] Create `/packages/features/webhooks/operations/send-ooo-deleted-webhook.controller.ts`
- [ ] Write tests for operations

#### 3.2: Migrate OOO Handlers
- [ ] Migrate `packages/trpc/server/routers/viewer/ooo/outOfOfficeCreateOrUpdate.handler.ts`
- [ ] Migrate any other OOO-related webhook usage
- [ ] Update tests

**Files to Migrate** (~2-3 files):
- `packages/trpc/server/routers/viewer/ooo/outOfOfficeCreateOrUpdate.handler.ts`
- Related OOO handlers

**Success Criteria**:
- ✅ OOO operations implemented and tested
- ✅ 2-3 files migrated
- ✅ OOO webhooks work in staging
- ✅ All tests passing

**Estimated Time**: 2-3 days

---

### Phase 4: FormWebhookService (#23241)

**GitHub Issue**: #23241  
**Goal**: Migrate form submission webhook usage

**Scope**:
- Form submitted webhooks
- Form submitted (no event) webhooks
- Routing form webhooks

**Tasks**:

#### 4.1: Create Form Operations
- [ ] Create `/packages/features/webhooks/operations/send-form-submitted-webhook.controller.ts`
- [ ] Create `/packages/features/webhooks/operations/send-form-submitted-no-event-webhook.controller.ts`
- [ ] Write tests for operations

#### 4.2: Migrate Form Submission Handlers
- [ ] Migrate `packages/app-store/routing-forms/lib/formSubmissionUtils.ts`
- [ ] Update routing form tests
- [ ] Migrate `packages/app-store/routing-forms/lib/formSubmissionUtils.test.ts`

#### 4.3: Migrate Tasker Jobs
- [ ] Migrate `packages/features/tasker/tasks/triggerFormSubmittedNoEvent/triggerFormSubmittedNoEventWebhook.ts`
- [ ] Update tasker job tests

**Files to Migrate** (~3-4 files):
- `packages/app-store/routing-forms/lib/formSubmissionUtils.ts`
- `packages/features/tasker/tasks/triggerFormSubmittedNoEvent/triggerFormSubmittedNoEventWebhook.ts`
- Related test files

**Success Criteria**:
- ✅ Form operations implemented and tested
- ✅ 3-4 files migrated
- ✅ Form webhooks work in staging
- ✅ Routing forms work correctly
- ✅ All tests passing

**Estimated Time**: 2-3 days

---

### Phase 5: RecordingWebhookService (#23242)

**GitHub Issue**: #23242  
**Goal**: Migrate recording-related webhook usage

**Scope**:
- Recording ready webhooks
- Transcription generated webhooks
- Recording download webhooks

**Tasks**:

#### 5.1: Create Recording Operations
- [ ] Create `/packages/features/webhooks/operations/send-recording-ready-webhook.controller.ts`
- [ ] Create `/packages/features/webhooks/operations/send-transcription-generated-webhook.controller.ts`
- [ ] Write tests for operations

#### 5.2: Migrate Recording Handlers
- [ ] Identify all recording webhook usage (search codebase)
- [ ] Migrate recording webhook handlers
- [ ] Update tests

**Files to Migrate** (~2-3 files):
- Recording-related handlers (TBD - needs search)

**Success Criteria**:
- ✅ Recording operations implemented and tested
- ✅ All recording webhook files migrated
- ✅ Recording webhooks work in staging
- ✅ All tests passing

**Estimated Time**: 2-3 days

---

### Phase 6: Clean up Legacy Code (#23243)

**GitHub Issue**: #23243  
**Goal**: Remove all deprecated legacy webhook code

**Scope**:
- Remove deprecated functions
- Remove old utility files
- Clean up imports
- Update documentation
- Remove backward compatibility code

**Tasks**:

#### 6.1: Mark Legacy Code as Deprecated
- [ ] Add `@deprecated` JSDoc to `getWebhooks()`
- [ ] Add `@deprecated` JSDoc to `sendPayload()`
- [ ] Add `@deprecated` JSDoc to `sendOrSchedulePayload()`
- [ ] Add `@deprecated` JSDoc to `schedulePayload()`
- [ ] Add `@deprecated` JSDoc to `handleWebhookTrigger()`
- [ ] Add runtime warnings in non-production environments

#### 6.2: Remove Legacy Functions (after deprecation period)
- [ ] Delete `packages/features/webhooks/lib/getWebhooks.ts`
- [ ] Delete `packages/features/webhooks/lib/sendPayload.ts`
- [ ] Delete `packages/features/webhooks/lib/sendOrSchedulePayload.ts`
- [ ] Delete `packages/features/webhooks/lib/schedulePayload.ts`
- [ ] Delete `packages/features/bookings/lib/handleWebhookTrigger.ts`

#### 6.3: Clean Up Tests
- [ ] Remove tests for deprecated functions
- [ ] Update remaining tests to use DI patterns
- [ ] Ensure 100% test coverage for operations

#### 6.4: Remove Backward Compatibility
- [ ] Remove individual getter functions (keep only facade)
- [ ] Remove `WEBHOOK_TOKENS` alias (keep only `WEBHOOK_TOKENS`)
- [ ] Clean up any temporary migration code

#### 6.5: Update Documentation
- [ ] Update README files
- [ ] Update code examples in docs
- [ ] Update migration guide (mark as complete)
- [ ] Add "Webhooks now use DI" to changelog

#### 6.6: Final Verification
- [ ] Run full test suite
- [ ] Run type checks
- [ ] Verify build succeeds
- [ ] Check for any remaining imports of old functions
- [ ] Monitor production for 1 week

**Files to Delete**:
- `packages/features/webhooks/lib/getWebhooks.ts`
- `packages/features/webhooks/lib/sendPayload.ts`
- `packages/features/webhooks/lib/sendOrSchedulePayload.ts`
- `packages/features/webhooks/lib/schedulePayload.ts`
- `packages/features/bookings/lib/handleWebhookTrigger.ts`
- Related test files

**Success Criteria**:
- ✅ All legacy functions removed
- ✅ No remaining imports of old patterns
- ✅ Build succeeds
- ✅ All tests passing
- ✅ Documentation updated
- ✅ Zero production issues for 1 week
- ✅ 100% DI compliance

**Estimated Time**: 3-4 days (after 2-week deprecation period)

---

## Timeline Summary

| Phase | Issue | Duration | Dependencies |
|-------|-------|----------|--------------|
| **Phase 0** | Infrastructure | 3-4 days | None |
| **Phase 1** | #23238 Core Booking | 1 week | Phase 0 |
| **Phase 2** | #23239 NoShow | 3-4 days | Phase 0 |
| **Phase 3** | #23240 OOO | 2-3 days | Phase 0 |
| **Phase 4** | #23241 Form | 2-3 days | Phase 0 |
| **Phase 5** | #23242 Recording | 2-3 days | Phase 0 |
| **Phase 6** | #23243 Cleanup | 3-4 days | Phases 1-5 complete |

**Total Time**: ~3-4 weeks (excluding deprecation waiting period)

**Critical Path**: Phase 0 → Phase 1 → Phase 6

**Parallel Work**: Phases 2-5 can be done in parallel after Phase 0 (by different developers)

---

## Phase Dependencies Graph

```
Phase 0 (Infrastructure)
    ↓
    ├──→ Phase 1 (Core Booking) ──┐
    ├──→ Phase 2 (NoShow)         ├──→ Phase 6 (Cleanup)
    ├──→ Phase 3 (OOO)            ├──→
    ├──→ Phase 4 (Form)           ├──→
    └──→ Phase 5 (Recording) ─────┘
```

**Notes**:
- Phase 0 must be completed first (all other phases depend on it)
- Phases 1-5 can be worked on in parallel by different developers
- Phase 6 requires all previous phases to be complete
- Phase 1 is the largest and should be prioritized

---

## Migration Strategy

### Parallel Running

**Strategy**: Run old and new implementations in parallel during migration.

```typescript
// In operations layer, can call both for validation
async function sendBookingCreatedWebhookController(params) {
  const webhooks = await getWebhookFeature();
  await webhooks.booking.emitBookingCreated(params);
  
  // Parallel validation (remove after confidence)
  if (process.env.VALIDATE_WEBHOOK_MIGRATION === "1") {
    const oldResult = await legacySendWebhook(params);
    // Compare results, log discrepancies
  }
}
```

### Feature Flags

**Use environment variables**:

```typescript
// Enable new DI-based webhooks
WEBHOOK_USE_DI=1

// Validate new vs old (both run, compare results)
VALIDATE_WEBHOOK_MIGRATION=1
```

### Rollback Plan

**If issues arise**:

1. **Set feature flag**: `WEBHOOK_USE_DI=0`
2. **Old code still exists**: Falls back to direct functions
3. **Fix issues**: Debug DI implementation
4. **Re-enable**: `WEBHOOK_USE_DI=1`

### Monitoring

**Metrics to track**:

- Webhook delivery success rate
- Webhook latency (p50, p95, p99)
- Error rates
- Tasker queue depth (if using TASKER_ENABLE_WEBHOOKS)

**Alerts**:

- Success rate < 95%
- Latency increase > 20%
- Error rate increase > 5%

---

## Testing Strategy

### Unit Tests

**Repository**:

```typescript
describe("WebhookRepository", () => {
  let repository: WebhookRepository;
  let mockPrisma: PrismaClient;
  
  beforeEach(() => {
    mockPrisma = createMockPrisma();
    repository = new WebhookRepository(mockPrisma);
  });
  
  test("should get subscribers", async () => {
    mockPrisma.webhook.findMany.mockResolvedValue([/* ... */]);
    const result = await repository.getSubscribers({
      userId: 1,
      triggerEvent: "BOOKING_CREATED",
    });
    expect(result).toHaveLength(1);
  });
});
```

**Services**:

```typescript
describe("BookingWebhookService", () => {
  let service: BookingWebhookService;
  let mockNotifier: IWebhookNotifier;
  let mockWebhookService: IWebhookService;
  
  beforeEach(() => {
    mockNotifier = createMockNotifier();
    mockWebhookService = createMockWebhookService();
    service = new BookingWebhookService(
      mockNotifier,
      mockWebhookService,
      mockTasker,
      mockLogger
    );
  });
  
  test("should emit booking created event", async () => {
    await service.emitBookingCreated({
      booking,
      eventType,
      triggerEvent: "BOOKING_CREATED",
    });
    expect(mockNotifier.notify).toHaveBeenCalled();
  });
});
```

### Integration Tests

**Container resolution**:

```typescript
describe("Webhook Container", () => {
  test("should resolve all services", () => {
    const webhookService = webhookContainer.get(WEBHOOK_TOKENS.WEBHOOK_SERVICE);
    expect(webhookService).toBeDefined();
    
    const bookingService = webhookContainer.get(WEBHOOK_TOKENS.BOOKING_WEBHOOK_SERVICE);
    expect(bookingService).toBeDefined();
  });
  
  test("should inject Prisma into repository", () => {
    const repo = webhookContainer.get(WEBHOOK_TOKENS.WEBHOOK_REPOSITORY);
    // Verify Prisma was injected (check instance type or mock)
  });
});
```

**Operations**:

```typescript
describe("sendBookingCreatedWebhookController", () => {
  test("should send webhook via DI services", async () => {
    // Setup test database
    // Create test booking
    // Call operation
    await sendBookingCreatedWebhookController({
      booking: testBooking,
      eventType: testEventType,
      triggerEvent: "BOOKING_CREATED",
    });
    // Verify webhook was sent (check DB, mock HTTP)
  });
});
```

### E2E Tests

**Booking flow**:

```typescript
test("Booking creation sends webhooks", async () => {
  // Create event type with webhook
  // Create booking
  // Verify webhook received by test endpoint
});
```

**Form submission**:

```typescript
test("Form submission sends webhooks", async () => {
  // Create form with webhook
  // Submit form
  // Verify webhook received
});
```

---

## Success Criteria

### Phase 1 (Infrastructure)

- [ ] Prisma injected via DI (no default parameters)
- [ ] All services resolvable from container
- [ ] Tokens in main DI_TOKENS
- [ ] No duplicate files in DI folder
- [ ] All existing tests pass

### Phase 2 (Facade)

- [ ] `getWebhookFeature()` returns working facade
- [ ] Facade exposes all services
- [ ] Individual getters have proper types
- [ ] Facade tests pass

### Phase 3 (Operations)

- [ ] At least 5 operations implemented
- [ ] All operations have tests (>80% coverage)
- [ ] Operations use DI services
- [ ] No direct instantiation in operations

### Phase 4 (Migration)

- [ ] 90%+ of production usage migrated
- [ ] All tests passing
- [ ] No production incidents
- [ ] Webhook metrics unchanged (success rate, latency)

### Phase 5 (Deprecation)

- [ ] All legacy functions marked @deprecated
- [ ] Runtime warnings in non-production
- [ ] Documentation updated
- [ ] Migration guide published

### Phase 6 (Cleanup)

- [ ] Legacy functions removed
- [ ] Zero usage of old patterns
- [ ] Build succeeds
- [ ] All tests pass

### Overall Success Metrics

- ✅ **100% DI compliance** - All webhooks use DI
- ✅ **Zero production issues** - No webhook-related incidents
- ✅ **Improved testability** - Mocking easier, tests faster
- ✅ **Better maintainability** - Clear service boundaries
- ✅ **Type safety** - Full TypeScript coverage
- ✅ **Performance maintained** - No degradation

---

## Risk Assessment

### High Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Breaking production webhooks | Medium | Critical | Feature flags, parallel running, rollback plan |
| Prisma connection pooling issues | Low | High | Monitor connection count, load test |
| Performance degradation | Low | Medium | Benchmark before/after, monitor latency |

### Medium Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Incomplete migration | Medium | Medium | Automated detection, deprecation warnings |
| Test coverage gaps | Medium | Medium | Require tests for all operations |
| Team unfamiliarity with DI | Medium | Low | Documentation, training, code reviews |

### Low Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Container overhead | Low | Low | DI has minimal overhead, test shows |
| Circular dependencies | Low | Medium | Prevented by proper service layering |

---

## Appendix

### A. File Structure After Wiring

```
packages/features/
├── di/
│   ├── webhooks/
│   │   ├── Webhooks.tokens.ts           ✅ Exported as WEBHOOK_TOKENS
│   │   ├── containers/
│   │   │   └── webhook.ts               ✅ Updated with facade
│   │   ├── modules/
│   │   │   └── Webhook.module.ts        ✅ Updated with Prisma
│   │   ├── repositories/                ✅ Empty (correct)
│   │   └── services/                    ✅ Empty (correct)
│   └── tokens.ts                        ✅ Includes WEBHOOK_TOKENS
│
├── webhooks/
│   ├── lib/
│   │   ├── facade/
│   │   │   └── WebhookFeature.ts        ✨ NEW
│   │   ├── service/
│   │   │   ├── WebhookService.ts
│   │   │   ├── BookingWebhookService.ts
│   │   │   ├── FormWebhookService.ts
│   │   │   ├── RecordingWebhookService.ts
│   │   │   ├── OOOWebhookService.ts
│   │   │   ├── WebhookNotifier.ts
│   │   │   └── WebhookNotificationHandler.ts
│   │   ├── repository/
│   │   │   └── WebhookRepository.ts     ✅ Updated (no singleton)
│   │   ├── factory/
│   │   ├── interface/
│   │   ├── dto/
│   │   ├── getWebhooks.ts               ⚠️  Deprecated
│   │   ├── sendPayload.ts               ⚠️  Deprecated
│   │   └── sendOrSchedulePayload.ts     ⚠️  Deprecated
│   │
│   └── operations/                       ✨ NEW
│       ├── send-booking-webhook.controller.ts
│       ├── send-booking-webhook.controller.test.ts
│       ├── send-form-webhook.controller.ts
│       └── send-form-webhook.controller.test.ts
```

### B. Usage Examples

#### Basic Usage (Facade)

```typescript
import { getWebhookFeature } from "@calcom/features/di/webhooks/containers/webhook";

async function handleBookingCreated(booking: Booking, eventType: EventType) {
  const webhooks = await getWebhookFeature();
  
  await webhooks.booking.emitBookingCreated({
    booking,
    eventType,
    triggerEvent: "BOOKING_CREATED",
  });
}
```

#### Advanced Usage (Direct Services)

```typescript
import { getBookingWebhookService } from "@calcom/features/di/webhooks/containers/webhook";

async function customWebhookLogic(booking: Booking) {
  const bookingWebhooks = getBookingWebhookService();
  
  // More control if needed
  await bookingWebhooks.emitBookingCreated({
    booking,
    eventType,
    triggerEvent: "BOOKING_CREATED",
  });
}
```

#### Operations Layer (Recommended)

```typescript
import { sendBookingCreatedWebhookController } from "@calcom/features/webhooks/operations/send-booking-webhook.controller";

async function handleBookingCreated(booking: Booking, eventType: EventType, span?: SpanFn) {
  await sendBookingCreatedWebhookController({
    booking,
    eventType,
    triggerEvent: "BOOKING_CREATED",
    span,
  });
}
```

### C. Testing Examples

#### Mocking the Facade

```typescript
import { vi } from "vitest";
import type { WebhookFeature } from "@calcom/features/webhooks/lib/facade/WebhookFeature";

vi.mock("@calcom/features/di/webhooks/containers/webhook", () => ({
  getWebhookFeature: vi.fn().mockResolvedValue({
    booking: {
      emitBookingCreated: vi.fn(),
      emitBookingCancelled: vi.fn(),
    },
    form: {
      emitFormSubmitted: vi.fn(),
    },
    // ... other services
  } as WebhookFeature),
}));
```

#### Integration Test Setup

```typescript
import { webhookContainer } from "@calcom/features/di/webhooks/containers/webhook";
import { WEBHOOK_TOKENS } from "@calcom/features/di/webhooks/Webhooks.tokens";

beforeEach(() => {
  // Container is fresh for each test (if needed)
  const repository = webhookContainer.get(WEBHOOK_TOKENS.WEBHOOK_REPOSITORY);
  // Setup test data...
});
```

---

**End of Document**

For questions or clarifications, contact the DI working group.
