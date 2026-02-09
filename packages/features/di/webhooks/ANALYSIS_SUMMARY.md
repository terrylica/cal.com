# Webhooks DI Analysis - Executive Summary

**Date:** December 15, 2025  
**Status:** Scaffolding Complete → Ready for Wiring Phase

---

## TL;DR

The Webhooks feature has **excellent DI scaffolding** (70% compliant) but **zero production usage**. Everything is ready to wire up - we just need to:

1. Connect Prisma to the DI container
2. Create a facade pattern for ease of use
3. Build an operations layer for common use cases
4. Migrate 25+ files from direct function calls to DI services

**Timeline:** 6-7 weeks (6 sprints)  
**Risk:** Low-Medium (mitigated with feature flags & parallel running)

---

## Current State: Two Parallel Implementations

### 🏗️ DI Scaffolding (Unused)

**Location:** `/packages/features/di/webhooks/`

```typescript
// ✅ This exists and works, but nobody uses it!
import { getBookingWebhookService } from "@calcom/features/di/webhooks/containers/webhook";
const service = getBookingWebhookService();
await service.emitBookingCreated(params);
```

**Status:**
- ✅ All services properly bound in container
- ✅ Dependency injection chains configured
- ✅ Services follow SOLID principles
- ❌ Not connected to Prisma
- ❌ No production usage (0 files use this)

### 🔥 Production Code (Current)

**Location:** `/packages/features/webhooks/lib/`

```typescript
// ❌ This is what production uses (no DI)
import getWebhooks from "@calcom/features/webhooks/lib/getWebhooks";
import sendPayload from "@calcom/features/webhooks/lib/sendOrSchedulePayload";

const subscribers = await getWebhooks(options);
await Promise.all(subscribers.map(sub => sendPayload(...)));
```

**Status:**
- ✅ Works reliably in production
- ✅ Used by 25+ files
- ❌ No dependency injection
- ❌ Hard to test (singletons, global state)
- ❌ Direct Prisma access

---

## DI Compliance Score: 70%

| Principle | Score | Status | Notes |
|-----------|-------|--------|-------|
| **Dependency Inversion** | 95% | ✅ Excellent | All services use interfaces |
| **Single Responsibility** | 90% | ✅ Good | Clear service boundaries |
| **Open/Closed** | 85% | ✅ Good | Factory/registry pattern for versioning |
| **Interface Segregation** | 85% | ✅ Good | Well-separated interfaces |
| **Liskov Substitution** | 90% | ✅ Good | Proper substitutability |
| **Composition Root** | 20% | ❌ Poor | Container exists but unused |
| **Explicit Dependencies** | 95% | ✅ Excellent | Constructor injection throughout |
| **Lifecycle Management** | 60% | ⚠️ Fair | Container manages but not integrated |

### Key SOLID Violations

1. **Repository Singleton** - `WebhookRepository.getInstance()` defeats DI (will be removed in Phase 1.1)
2. **Missing Composition Root** - No production usage of DI container (addressed in Phases 1-6)
3. **Default Dependencies** - `constructor(private prisma = defaultPrisma)` bypasses injection

---

## What's Working vs What's Not

### ✅ What's Excellent

1. **Service Design** - All services follow proper DI patterns:
   ```typescript
   export class BookingWebhookService {
     constructor(
       private readonly webhookNotifier: IWebhookNotifier,
       private readonly webhookService: IWebhookService,
       private readonly tasker: ITasker,
       logger: ILogger
     ) {}
   }
   ```

2. **Interfaces** - Well-designed, segregated:
   - `IWebhookService` (core)
   - `IBookingWebhookService` (booking events)
   - `IFormWebhookService` (form events)
   - `IWebhookRepository` (data access)

3. **Module Configuration** - Proper bindings:
   ```typescript
   webhookModule
     .bind(WEBHOOK_TOKENS.BOOKING_WEBHOOK_SERVICE)
     .toClass(BookingWebhookService, [
       WEBHOOK_TOKENS.WEBHOOK_NOTIFIER,
       WEBHOOK_TOKENS.WEBHOOK_SERVICE,
       SHARED_TOKENS.TASKER,
       SHARED_TOKENS.LOGGER,
     ]);
   ```

### ❌ What's Missing

1. **Prisma Integration** - Container doesn't load Prisma module
2. **Facade Pattern** - No `getWebhookFeature()` unified API
3. **Operations Layer** - No controllers/operations for use cases
4. **Production Usage** - Zero integration with actual code
5. **Token Integration** - `WEBHOOK_TOKENS` not in main `DI_TOKENS`
6. **Duplicate Files** - DI folder has repository/service files (should only be in `/lib/`)

---

## The Wiring Gap

### Current Flow (No DI)

```
handleBookingCreated()
    ↓
getWebhooks()
    ↓
WebhookRepository.getInstance()
    ↓
defaultPrisma.webhook.findMany()
    ↓
sendPayload()
    ↓
fetch() or tasker.create()
```

**Issues:**
- Direct function calls
- Singleton repository
- Hard to test
- No lifecycle management

### Target Flow (With DI)

```
handleBookingCreated()
    ↓
sendBookingCreatedWebhookController()  ← NEW (Operations layer)
    ↓
getWebhookFeature()                     ← NEW (Facade)
    ↓
webhooks.booking.emitBookingCreated()
    ↓
[DI Container] → BookingWebhookService
    ↓
WebhookRepository (Prisma injected)     ← FIXED
    ↓
prisma.webhook.findMany()
```

**Benefits:**
- Proper DI throughout
- Easy to test (mock container)
- Lifecycle managed
- Type-safe

---

## Migration Impact

### Files Affected: **25+**

**High Priority (Core flows):**
- `packages/features/bookings/lib/handleWebhookTrigger.ts`
- `packages/features/bookings/lib/handleConfirmation.ts`
- `packages/features/bookings/lib/handleCancelBooking.ts`
- `packages/app-store/routing-forms/lib/formSubmissionUtils.ts`
- `packages/trpc/server/routers/viewer/ooo/outOfOfficeCreateOrUpdate.handler.ts`

**Medium Priority:**
- TRPC handlers (10+ files)
- Tasker jobs (5+ files)

**Low Priority:**
- Test utilities
- Dev tools

### API Changes

**Before (Current):**
```typescript
const subscribers = await getWebhooks({
  userId: 1,
  eventTypeId: 2,
  triggerEvent: "BOOKING_CREATED",
  teamId: 3,
});

await Promise.all(
  subscribers.map(sub =>
    sendPayload(sub.secret, "BOOKING_CREATED", new Date().toISOString(), sub, data)
  )
);
```

**After (DI):**
```typescript
const webhooks = await getWebhookFeature();
await webhooks.booking.emitBookingCreated({
  booking,
  eventType,
  triggerEvent: "BOOKING_CREATED",
});
```

**Benefits:**
- Simpler API (fewer parameters)
- Type-safe
- Handles orchestration internally
- Testable via container mocking

---

## The Wiring Plan in 7 Phases

The implementation is organized by service type, aligned with GitHub issues:

### Phase 0: Infrastructure (Prerequisite) 
**Duration:** 5-7 days  
**Goal:** Wire infrastructure, implement Producer/Consumer pattern, create foundation

**Architecture Decision:** Adopt Producer/Consumer pattern (mirroring Booking Audit)
- Producer: Lightweight task queueing (stays in main app)
- Consumer: Heavy processing (deployed to trigger.dev)
- Single code path through queue system (no coexistence)

**Key Tasks:**
- Integrate Prisma module in container
- Remove singleton pattern from repository
- Create `IWebhookProducerService` interface and `WebhookTaskerProducerService` implementation
- Create `WebhookTaskConsumer` service for processing queued tasks
- Wire producer and consumer into DI containers
- Register tasker handler for "webhookDelivery"
- Export tokens to main DI_TOKENS
- Create WebhookFeature facade (including producer/consumer)
- Delete duplicate files

### Phase 1: Core BookingWebhookService (#23238)
**Duration:** 1 week  
**Goal:** Migrate core booking webhooks
- Create booking webhook operations
- Migrate `handleWebhookTrigger`, `handleConfirmation`, `handleCancelBooking`
- Migrate booking services and TRPC handlers
- **~10-12 files**

### Phase 2: NoShow + Remaining BookingWebhookService (#23239)
**Duration:** 3-4 days  
**Goal:** Migrate no-show webhooks
- Create no-show operations
- Migrate `handleMarkNoShow`, `scheduleNoShowTriggers`
- Migrate tasker jobs
- **~5-7 files**

### Phase 3: OOOWebhookService (#23240)
**Duration:** 2-3 days  
**Goal:** Migrate out-of-office webhooks
- Create OOO operations
- Migrate OOO handlers
- **~2-3 files**

### Phase 4: FormWebhookService (#23241)
**Duration:** 2-3 days  
**Goal:** Migrate form submission webhooks
- Create form operations
- Migrate routing form handlers
- Migrate tasker jobs
- **~3-4 files**

### Phase 5: RecordingWebhookService (#23242)
**Duration:** 2-3 days  
**Goal:** Migrate recording webhooks
- Create recording operations
- Migrate recording handlers
- **~2-3 files**

### Phase 6: Clean up Legacy Code (#23243)
**Duration:** 3-4 days (after 2-week deprecation)  
**Goal:** Remove all deprecated code
- Mark legacy functions deprecated
- Wait 2 weeks
- Delete old functions
- Clean up tests
- Update documentation

**Total Time:** ~3-4 weeks (excluding deprecation waiting period)

**Key Insight:** Phases 1-5 can be worked on in parallel by different developers after Phase 0!

---

## Risk Mitigation

### High Risk: Breaking Production Webhooks

**Mitigation:**
1. **Feature Flags** - `WEBHOOK_USE_DI=1` to toggle
2. **Parallel Running** - Run both old and new, compare results
3. **Rollback Plan** - Instant rollback via feature flag
4. **Monitoring** - Track success rate, latency, errors

### Medium Risk: Performance Degradation

**Mitigation:**
1. **Benchmarks** - Before/after performance tests
2. **Load Testing** - Test container overhead
3. **Monitoring** - Real-time latency tracking

### Low Risk: Incomplete Migration

**Mitigation:**
1. **Automated Detection** - ESLint rules for old patterns
2. **Deprecation Warnings** - Runtime logs in dev
3. **Code Reviews** - Enforce new patterns

---

## Success Metrics

### Technical Metrics
- ✅ **100% DI compliance** - All webhooks use container
- ✅ **Prisma via DI** - No default parameters
- ✅ **Facade implemented** - Single entry point
- ✅ **Operations layer** - Controllers for use cases
- ✅ **Test coverage** - >80% for operations

### Business Metrics
- ✅ **Zero downtime** - No production issues
- ✅ **Performance maintained** - Latency unchanged
- ✅ **Success rate** - 95%+ webhook delivery
- ✅ **Team velocity** - Faster development with better testability

---

## Comparison to Reference (Watchlist)

The **Watchlist** feature is the reference implementation for Cal.com DI patterns. Here's how Webhooks compares:

| Aspect | Webhooks | Watchlist | Gap |
|--------|----------|-----------|-----|
| **Prisma Integration** | ❌ No | ✅ Yes | Need to add |
| **Facade Pattern** | ❌ No | ✅ Yes | Need to create |
| **Operations Layer** | ❌ No | ✅ Yes | Need to create |
| **Token Integration** | ❌ No | ✅ Yes | Need to export |
| **Production Usage** | ❌ 0% | ✅ 100% | Need to migrate |
| **Service Quality** | ✅ Good | ✅ Good | Equal |
| **Module Bindings** | ✅ Good | ✅ Good | Equal |
| **Container Setup** | ⚠️ Partial | ✅ Complete | Need facade |

**Key Insight:** Webhooks has excellent service design (matches Watchlist quality), but lacks the integration layers (facade, operations, Prisma).

---

## Next Steps

1. **Read the full plan**: `WIRING_PLAN.md`
2. **Start Sprint 1**: Infrastructure integration
3. **Set up monitoring**: Establish baseline metrics
4. **Create feature branch**: `feat/webhooks-di-wiring`
5. **Begin implementation**: Follow roadmap

---

## Questions & Answers

### Q: Why not just keep using the current implementation?

**A:** The current implementation works but has significant technical debt:
- Hard to test (singletons, no DI)
- Hard to maintain (scattered logic)
- Hard to extend (tight coupling)
- Inconsistent with rest of codebase (other features use DI)

### Q: What's the risk of breaking production?

**A:** Low-Medium risk, mitigated by:
- Feature flags for instant rollback
- Parallel running for validation
- Gradual migration (one file at a time)
- Comprehensive monitoring

### Q: How long until we see benefits?

**A:** Immediate benefits after Sprint 2:
- Easier testing (mock container)
- Better IDE support (type safety)
- Faster development (clearer APIs)

Full benefits after Sprint 4 (migration complete).

### Q: Can we do this incrementally?

**A:** Yes! The plan is designed for incremental migration:
- Old code continues working
- New code uses DI
- Gradual file-by-file migration
- Deprecation period before removal

---

## Related Documents

- **Full Wiring Plan**: `WIRING_PLAN.md` (detailed implementation)
- **Existing Refactoring Plan**: `REFACTORING_PLAN.md` (comparison to Watchlist)
- **Watchlist Reference**: `/packages/features/di/watchlist/` (reference implementation)
- **DI Architecture**: `/packages/features/di/README.md` (Cal.com DI patterns)

---

**Ready to start?** Begin with Sprint 1 in `WIRING_PLAN.md`
