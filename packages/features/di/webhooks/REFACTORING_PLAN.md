# Webhook DI Structure Refactoring Plan

## Overview

This document outlines the differences between the current webhook DI implementation and the watchlist DI pattern, which serves as the reference implementation. The goal is to align the webhook DI structure with established patterns for consistency and maintainability.

---

## Current State Analysis

### What's Already in Place ✅

1. **Tokens** (`Webhooks.tokens.ts`) - Complete
   - Core services (WebhookService, BookingWebhookService, FormWebhookService, etc.)
   - Payload builders (BookingPayloadBuilder, FormPayloadBuilder, etc.)
   - Repository (WebhookRepository)
   - Notifiers and handlers

2. **Module** (`modules/Webhook.module.ts`) - Complete
   - All services properly bound with dependencies
   - Proper dependency injection chains configured
   - All payload builders registered

3. **Container** (`containers/webhook.ts`) - Partial
   - Container created and loaded with all modules
   - Export functions exist but need improvements

4. **Actual Implementations** - Complete
   - All services exist in `/packages/features/webhooks/lib/service/`
   - Repository exists in `/packages/features/webhooks/lib/repository/`
   - All payload builders exist in `/packages/features/webhooks/lib/factory/`

---

## Key Differences from Watchlist Pattern

### 1. ❌ Token Integration

**Current State (Webhook):**
```typescript
// Tokens NOT exported in main DI_TOKENS
// Lives in isolation as WEBHOOK_TOKENS
```

**Reference Pattern (Watchlist):**
```typescript
// packages/features/di/tokens.ts
import { WATCHLIST_DI_TOKENS } from "./watchlist/Watchlist.tokens";

export const DI_TOKENS = {
  // ... other tokens
  ...WATCHLIST_DI_TOKENS,
};
```

**Required Action:**
- Export `WEBHOOK_TOKENS` from `/packages/features/di/webhooks/Webhooks.tokens.ts`
- Import and spread them into main `DI_TOKENS` in `/packages/features/di/tokens.ts`

---

### 2. ❌ Prisma Module Integration

**Current State (Webhook):**
```typescript
// No Prisma module loading
// Repository doesn't explicitly depend on Prisma through DI
```

**Reference Pattern (Watchlist):**
```typescript
// packages/features/di/watchlist/containers/watchlist.ts
import { moduleLoader as prismaModuleLoader } from "@calcom/prisma/prisma.module";

export const watchlistContainer = createContainer();
prismaModuleLoader.loadModule(watchlistContainer);

// Repositories depend on DI_TOKENS.PRISMA_CLIENT
watchlistModule
  .bind(WATCHLIST_DI_TOKENS.GLOBAL_WATCHLIST_REPOSITORY)
  .toClass(GlobalWatchlistRepository, [DI_TOKENS.PRISMA_CLIENT]);
```

**Required Action:**
- Add Prisma module loader to webhook container
- Update WebhookRepository to accept Prisma client through DI
- Bind repository with `DI_TOKENS.PRISMA_CLIENT` dependency

---

### 3. ❌ Facade Pattern (CRITICAL)

**Current State (Webhook):**
```typescript
// No facade - exposes individual services directly
export function getBookingWebhookService() { ... }
export function getFormWebhookService() { ... }
export function getRecordingWebhookService() { ... }
export function getWebhookNotifier() { ... }
```

**Reference Pattern (Watchlist):**
```typescript
// packages/features/watchlist/lib/facade/WatchlistFeature.ts
export interface WatchlistFeature {
  globalBlocking: GlobalBlockingService;
  orgBlocking: OrganizationBlockingService;
  watchlist: WatchlistService;
  audit: WatchlistAuditService;
}

export function createWatchlistFeature(container: Container): WatchlistFeature {
  const globalRepo = container.get<IGlobalWatchlistRepository>(...);
  const orgRepo = container.get<IOrganizationWatchlistRepository>(...);
  const auditRepo = container.get<IAuditRepository>(...);
  
  return {
    globalBlocking: new GlobalBlockingService({ globalRepo }),
    orgBlocking: new OrganizationBlockingService({ orgRepo }),
    watchlist: new WatchlistService({ globalRepo, orgRepo, logger }),
    audit: new WatchlistAuditService({ auditRepository: auditRepo }),
  };
}

// Container exports facade
export async function getWatchlistFeature(): Promise<WatchlistFeature> {
  return createWatchlistFeature(watchlistContainer);
}
```

**Usage in Controllers:**
```typescript
const watchlist = await getWatchlistFeature();
watchlist.globalBlocking.isBlocked(email);
watchlist.watchlist.listAllSystemEntries();
```

**Required Action:**
- Create `/packages/features/webhooks/lib/facade/WebhookFeature.ts`
- Define `WebhookFeature` interface with grouped services
- Implement `createWebhookFeature(container)` factory function
- Update container to export `getWebhookFeature()` as primary export
- Keep individual getters for backward compatibility (deprecate later)

**Proposed WebhookFeature Interface:**
```typescript
export interface WebhookFeature {
  // Core webhook management
  webhook: IWebhookService;
  
  // Event-specific services
  booking: IBookingWebhookService;
  form: IFormWebhookService;
  recording: IRecordingWebhookService;
  ooo: IOOOWebhookService;
  
  // Infrastructure
  notifier: IWebhookNotifier;
  repository: IWebhookRepository;
}
```

---

### 4. ❌ Module Structure - Duplicate Files

**Current State (Webhook):**
```
packages/features/di/webhooks/
  ├── containers/
  ├── modules/
  ├── repositories/          ❌ SHOULD NOT EXIST
  │   └── Webhook.repository.ts
  ├── services/              ❌ SHOULD NOT EXIST
  │   └── Webhook.service.ts
  └── Webhooks.tokens.ts
```

**Reference Pattern (Watchlist):**
```
packages/features/di/watchlist/
  ├── containers/
  ├── modules/
  ├── repositories/          ✅ EMPTY (correct)
  ├── services/              ✅ EMPTY (correct)
  └── Watchlist.tokens.ts
```

**Explanation:**
- DI folder should only contain wiring/configuration
- Actual implementations live in `/packages/features/webhooks/lib/`
- Duplicate files create confusion and maintenance burden

**Required Action:**
- Delete `/packages/features/di/webhooks/repositories/Webhook.repository.ts`
- Delete `/packages/features/di/webhooks/services/Webhook.service.ts`
- Keep directories for organizational consistency (can be empty)

---

### 5. ❌ Container Export Pattern - Missing Types

**Current State (Webhook):**
```typescript
export function getBookingWebhookService() {
  return webhookContainer.get(WEBHOOK_TOKENS.BOOKING_WEBHOOK_SERVICE);
}
```

**Reference Pattern (Watchlist):**
```typescript
export function getWatchlistService() {
  return watchlistContainer.get<WatchlistService>(WATCHLIST_DI_TOKENS.WATCHLIST_SERVICE);
}
```

**Required Action:**
- Add proper TypeScript generic types to all getter functions
- Import service types from implementation files
- Ensure type safety for consumers

---

### 6. ❌ Usage Pattern - No Controllers

**Current State (Webhook):**
- No controller usage found
- DI not connected to actual application code
- Services instantiated directly in various parts of codebase

**Reference Pattern (Watchlist):**
```typescript
// packages/features/watchlist/operations/check-if-email-in-watchlist.controller.ts
export async function checkIfEmailIsBlockedInWatchlistController(
  params: CheckEmailBlockedParams
): Promise<boolean> {
  const watchlist = await getWatchlistFeature();
  
  const globalResult = await watchlist.globalBlocking.isBlocked(normalizedEmail);
  if (globalResult.isBlocked) return true;
  
  if (organizationId) {
    const orgResult = await watchlist.orgBlocking.isBlocked(normalizedEmail, organizationId);
    return orgResult.isBlocked;
  }
  
  return false;
}
```

**Required Action:**
- Audit current webhook usage patterns
- Create controller/operations layer in `/packages/features/webhooks/operations/`
- Migrate existing direct instantiations to use DI container
- Consider operations like:
  - `sendBookingWebhookController()`
  - `scheduleWebhookController()`
  - `cancelWebhookController()`

---

### 7. ⚠️ Specialized Service Containers (Optional)

**Reference Pattern (Watchlist):**
```typescript
// packages/features/di/watchlist/containers/SpamCheckService.container.ts
export const getSpamCheckService = (): SpamCheckService => {
  const globalBlockingService = getGlobalBlockingService();
  const organizationBlockingService = getOrganizationBlockingService();
  return new SpamCheckService(globalBlockingService, organizationBlockingService);
};
```

**Consideration for Webhook:**
- May need specialized containers for webhook pipelines
- Example: `WebhookPipelineService` that orchestrates multiple webhook operations
- Not required immediately but good to plan for

---

## Implementation Plan

### Phase 1: Foundation (Priority 1 - CRITICAL)

**Task 1.1: Create Facade Pattern**
- [ ] Create `/packages/features/webhooks/lib/facade/WebhookFeature.ts`
- [ ] Define `WebhookFeature` interface
- [ ] Implement `createWebhookFeature(container)` factory
- [ ] Update container to export `getWebhookFeature()`

**Task 1.2: Clean Up Duplicate Files**
- [ ] Delete `/packages/features/di/webhooks/repositories/Webhook.repository.ts`
- [ ] Delete `/packages/features/di/webhooks/services/Webhook.service.ts`
- [ ] Verify imports still work after deletion

**Task 1.3: Add Prisma Integration**
- [ ] Import `prismaModuleLoader` in webhook container
- [ ] Load Prisma module: `prismaModuleLoader.loadModule(webhookContainer)`
- [ ] Update WebhookRepository binding to depend on `DI_TOKENS.PRISMA_CLIENT`
- [ ] Update WebhookRepository implementation to accept Prisma through constructor

### Phase 2: Integration (Priority 2 - HIGH)

**Task 2.1: Token Integration**
- [ ] Export `WEBHOOK_TOKENS` as `WEBHOOK_TOKENS` from `Webhooks.tokens.ts`
- [ ] Import in `/packages/features/di/tokens.ts`
- [ ] Add to `DI_TOKENS`: `...WEBHOOK_TOKENS`

**Task 2.2: Type Safety**
- [ ] Add generic types to all getter functions
- [ ] Import service types from implementation files
- [ ] Ensure TypeScript compilation passes with strict mode

### Phase 3: Usage (Priority 3 - MEDIUM)

**Task 3.1: Create Operations Layer**
- [ ] Create `/packages/features/webhooks/operations/` directory
- [ ] Implement key operations:
  - `send-booking-webhook.controller.ts`
  - `schedule-webhook.controller.ts`
  - `cancel-webhook.controller.ts`
- [ ] Write tests for operations

**Task 3.2: Migration Strategy**
- [ ] Identify current webhook instantiation patterns
- [ ] Create migration guide for consumers
- [ ] Update high-traffic paths first
- [ ] Deprecate old patterns with warning logs

### Phase 4: Enhancement (Priority 4 - LOW)

**Task 4.1: Specialized Containers (if needed)**
- [ ] Identify common webhook operation patterns
- [ ] Create specialized containers for these patterns
- [ ] Document usage examples

**Task 4.2: Documentation**
- [ ] Update webhook feature documentation
- [ ] Create migration guide
- [ ] Add examples to developer docs

---

## File Structure After Refactoring

```
packages/features/
├── di/
│   ├── webhooks/
│   │   ├── containers/
│   │   │   └── webhook.ts                    ✅ Updated with facade
│   │   ├── modules/
│   │   │   └── Webhook.module.ts             ✅ Updated with Prisma
│   │   ├── repositories/                     ✅ Empty (correct)
│   │   ├── services/                         ✅ Empty (correct)
│   │   └── Webhooks.tokens.ts                ✅ Exported as WEBHOOK_TOKENS
│   └── tokens.ts                             ✅ Includes WEBHOOK_TOKENS
│
├── webhooks/
│   ├── lib/
│   │   ├── facade/
│   │   │   └── WebhookFeature.ts             ✨ NEW - Facade implementation
│   │   ├── repository/
│   │   │   └── WebhookRepository.ts          ✅ Updated with Prisma DI
│   │   ├── service/
│   │   │   ├── WebhookService.ts
│   │   │   ├── BookingWebhookService.ts
│   │   │   ├── FormWebhookService.ts
│   │   │   ├── RecordingWebhookService.ts
│   │   │   └── OOOWebhookService.ts
│   │   └── ...
│   └── operations/                           ✨ NEW - Operations layer
│       ├── send-booking-webhook.controller.ts
│       ├── schedule-webhook.controller.ts
│       └── cancel-webhook.controller.ts
```

---

## Expected Usage After Refactoring

### Primary Pattern (Recommended)
```typescript
import { getWebhookFeature } from "@calcom/features/di/webhooks/containers/webhook";

async function handleBookingCreated(booking: Booking) {
  const webhooks = await getWebhookFeature();
  
  await webhooks.booking.emitBookingCreated({
    booking,
    eventType,
    triggerEvent: "BOOKING_CREATED",
  });
}
```

### Individual Service Pattern (Backward Compatible)
```typescript
import { getBookingWebhookService } from "@calcom/features/di/webhooks/containers/webhook";

const bookingWebhookService = getBookingWebhookService();
await bookingWebhookService.emitBookingCreated({...});
```

### Operations Pattern (Controller Layer)
```typescript
import { sendBookingWebhookController } from "@calcom/features/webhooks/operations/send-booking-webhook.controller";

await sendBookingWebhookController({
  bookingId: 123,
  triggerEvent: "BOOKING_CREATED",
  span,
});
```

---

## Testing Strategy

1. **Unit Tests**
   - Test facade factory function
   - Test container bindings
   - Verify service instantiation

2. **Integration Tests**
   - Test DI resolution
   - Test service interactions
   - Verify Prisma integration

3. **Migration Tests**
   - Ensure backward compatibility
   - Test both old and new patterns
   - Verify no regressions

---

## Success Criteria

- [ ] All webhook DI patterns match watchlist structure
- [ ] No duplicate files in DI folder
- [ ] Facade pattern implemented and tested
- [ ] Prisma properly integrated
- [ ] Tokens exported in main DI_TOKENS
- [ ] All getter functions properly typed
- [ ] Operations layer created with key controllers
- [ ] Documentation updated
- [ ] Migration guide written
- [ ] All tests passing

---

## Notes & Considerations

1. **Backward Compatibility**: Keep individual getter functions during migration period
2. **Performance**: Facade pattern has minimal overhead due to lazy instantiation
3. **Testing**: Mock container in tests for better isolation
4. **Documentation**: Update developer docs with new patterns
5. **Deprecation**: Plan deprecation timeline for old patterns (6 months recommended)

---

## Related Files to Review

- `/packages/features/di/watchlist/` - Reference implementation
- `/packages/features/watchlist/lib/facade/WatchlistFeature.ts` - Facade pattern example
- `/packages/features/watchlist/operations/` - Operations layer examples
- `/packages/features/di/tokens.ts` - Main DI tokens file
- `/packages/prisma/prisma.module.ts` - Prisma module loader

---

**Last Updated**: 2025-01-XX  
**Status**: Planning Phase  
**Owner**: Engineering Team

