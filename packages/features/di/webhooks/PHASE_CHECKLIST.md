# Webhooks DI Wiring - Phase Checklist

**Quick reference for tracking progress across all phases**

---

## ⚠️ **BEFORE STARTING ANY WORK**

**📋 Review: [CODE_STANDARDS.md](./CODE_STANDARDS.md) - MANDATORY for all PRs**
- No placeholder tests, no `as any`, discriminated unions, SOLID, strict DI
- ≤500 lines, ≤10 files per PR | Complete checklist before submitting

---

## Overview

| Phase | GitHub Issue | Service | Files | Duration | Status |
|-------|--------------|---------|-------|----------|--------|
| **0** | N/A | Infrastructure | Foundation | 3-4 days | ✅ Complete |
| **1** | #23238 | Core BookingWebhookService | ~10-12 | 1 week | ⏸️ Not Started |
| **2** | #23239 | NoShow + Booking | ~5-7 | 3-4 days | ⏸️ Not Started |
| **3** | #23240 | OOOWebhookService | ~2-3 | 2-3 days | ⏸️ Not Started |
| **4** | #23241 | FormWebhookService | ~3-4 | 2-3 days | ⏸️ Not Started |
| **5** | #23242 | RecordingWebhookService | ~2-3 | 2-3 days | ⏸️ Not Started |
| **6** | #23243 | Cleanup | All | 3-4 days | ⏸️ Not Started |

**Status Legend:**
- ⏸️ Not Started
- 🚧 In Progress
- ✅ Complete
- ⚠️ Blocked

---

## Phase 0: Infrastructure (Prerequisite)

**Status:** ✅ Complete  
**Actual Duration:** 3 days  
**Dependencies:** None  
**GitHub Issue:** N/A

**Architecture:** Adopt Producer/Consumer pattern (mirroring Booking Audit)
- Producer: Lightweight task queueing
- Consumer: Heavy processing on trigger.dev
- Single code path through queue system (no coexistence)

**Note**: Singleton pattern is intentionally kept in Phase 0 to avoid touching live code. Will be removed in Phase 1.1.

### 0.1 Prisma Integration (Without Removing Singleton)

- [x] Import `prismaModuleLoader` in webhook container
- [x] Add `prismaModuleLoader.loadModule(webhookContainer)` call
- [x] Update `WebhookRepository` binding: `.toClass(WebhookRepository, [DI_TOKENS.PRISMA_CLIENT])`
- [x] Keep `getInstance()` and `defaultPrisma` for backward compatibility
- [x] Test: Verify repository resolves with injected Prisma through DI

**Files:**
- `packages/features/di/webhooks/containers/webhook.ts`
- `packages/features/di/webhooks/modules/Webhook.module.ts`
- `packages/features/webhooks/lib/repository/WebhookRepository.ts`

### 0.2 Producer/Consumer - Interfaces & Types

**Create Producer Interface:**
- [x] Create `packages/features/webhooks/lib/interface/WebhookProducerService.ts`
- [x] Define `IWebhookProducerService` interface
- [x] Add queue methods for all webhook events

**Create Task Payload Types:**
- [x] Create `packages/features/webhooks/lib/types/webhookTask.ts`
- [x] Define `WebhookTaskPayload` with Zod schema
- [x] Include all required fields

**Files:**
- `packages/features/webhooks/lib/interface/WebhookProducerService.ts` ✅
- `packages/features/webhooks/lib/types/webhookTask.ts` ✅

### 0.3 Producer Implementation

**Create Producer Service:**
- [x] Create `packages/features/webhooks/lib/service/WebhookTaskerProducerService.ts`
- [x] Implement `IWebhookProducerService` interface
- [x] Constructor deps: `ITasker`, `ILogger` only
- [x] Implement all queue methods
- [x] Generate `operationId` with `uuidv4()` if not provided
- [x] Add error handling and logging
- [x] Test: Unit tests with mocked Tasker

**Create Producer Module:**
- [x] Create `packages/features/di/webhooks/modules/WebhookProducerService.module.ts`
- [x] Bind `WebhookTaskerProducerService` to token
- [x] Dependencies configured correctly

**Create Producer Container:**
- [x] Integrated into main webhook container
- [x] Export `getWebhookProducerService()` function
- [x] Return typed instance

**Files:**
- `packages/features/webhooks/lib/service/WebhookTaskerProducerService.ts` ✅
- `packages/features/di/webhooks/modules/WebhookProducerService.module.ts` ✅
- Integrated into `packages/features/di/webhooks/containers/webhook.ts` ✅

### 0.4 Consumer Implementation (with Strategy Pattern for SOLID/DIP Compliance)

**Create Consumer Service:**
- [x] Create `packages/features/webhooks/lib/service/WebhookTaskConsumer.ts`
- [x] Constructor deps: `IWebhookRepository`, `IWebhookDataFetcher[]`, `ILogger`
- [x] Implement `processWebhookTask(payload, taskId)` with Strategy Pattern
- [x] Add error handling and logging
- [x] Test: Unit tests with mocked dependencies
- [x] **SOLID Compliance**: Removed switch statement, uses polymorphic `canHandle()` method
- [ ] Full data fetching implementation (Phase 1+)
- [ ] PayloadBuilder integration (Phase 1+)
- [ ] HTTP delivery implementation (Phase 1+)

**Create Data Fetcher Interface (Strategy Pattern):**
- [x] Create `packages/features/webhooks/lib/interface/IWebhookDataFetcher.ts`
- [x] Define `IWebhookDataFetcher` interface
- [x] Define `SubscriberContext` type

**Create Data Fetcher Implementations (5 Strategies):**
- [x] Create `packages/features/webhooks/lib/service/data-fetchers/BookingWebhookDataFetcher.ts`
- [x] Create `packages/features/webhooks/lib/service/data-fetchers/PaymentWebhookDataFetcher.ts`
- [x] Create `packages/features/webhooks/lib/service/data-fetchers/FormWebhookDataFetcher.ts`
- [x] Create `packages/features/webhooks/lib/service/data-fetchers/RecordingWebhookDataFetcher.ts`
- [x] Create `packages/features/webhooks/lib/service/data-fetchers/OOOWebhookDataFetcher.ts`

**Create Data Fetcher Modules:**
- [x] Create `packages/features/di/webhooks/modules/BookingWebhookDataFetcher.module.ts`
- [x] Create `packages/features/di/webhooks/modules/PaymentWebhookDataFetcher.module.ts`
- [x] Create `packages/features/di/webhooks/modules/FormWebhookDataFetcher.module.ts`
- [x] Create `packages/features/di/webhooks/modules/RecordingWebhookDataFetcher.module.ts`
- [x] Create `packages/features/di/webhooks/modules/OOOWebhookDataFetcher.module.ts`

**Update Consumer Module:**
- [x] Update `packages/features/di/webhooks/modules/WebhookTaskConsumer.module.ts`
- [x] Inject data fetchers array using factory pattern
- [x] Dependencies configured correctly

**Update Consumer Container:**
- [x] Load all 5 data fetcher modules in webhook container
- [x] Export `getWebhookTaskConsumer()` function
- [x] Return typed instance

**Architecture Benefits:**
- ✅ **Open/Closed Principle**: Add new webhook types by registering fetchers, no code modification
- ✅ **Single Responsibility Principle**: Consumer orchestrates, fetchers handle domain logic
- ✅ **Dependency Inversion Principle**: Consumer depends on `IWebhookDataFetcher` interface

**Files:**
- `packages/features/webhooks/lib/interface/IWebhookDataFetcher.ts` ✅
- `packages/features/webhooks/lib/service/data-fetchers/BookingWebhookDataFetcher.ts` ✅
- `packages/features/webhooks/lib/service/data-fetchers/PaymentWebhookDataFetcher.ts` ✅
- `packages/features/webhooks/lib/service/data-fetchers/FormWebhookDataFetcher.ts` ✅
- `packages/features/webhooks/lib/service/data-fetchers/RecordingWebhookDataFetcher.ts` ✅
- `packages/features/webhooks/lib/service/data-fetchers/OOOWebhookDataFetcher.ts` ✅
- `packages/features/webhooks/lib/service/WebhookTaskConsumer.ts` ✅ (refactored)
- `packages/features/di/webhooks/modules/WebhookTaskConsumer.module.ts` ✅ (updated)
- `packages/features/di/webhooks/modules/*WebhookDataFetcher.module.ts` ✅ (5 new)
- Integrated into `packages/features/di/webhooks/containers/webhook.ts` ✅

### 0.5 Token Integration

**Update Tokens:**
- [x] Add `WEBHOOK_PRODUCER_SERVICE` token
- [x] Add `WEBHOOK_PRODUCER_SERVICE_MODULE` token
- [x] Add `WEBHOOK_TASK_CONSUMER` token
- [x] Add `WEBHOOK_TASK_CONSUMER_MODULE` token
- [x] Add `BOOKING_DATA_FETCHER` token (Strategy Pattern)
- [x] Add `PAYMENT_DATA_FETCHER` token (Strategy Pattern)
- [x] Add `FORM_DATA_FETCHER` token (Strategy Pattern)
- [x] Add `RECORDING_DATA_FETCHER` token (Strategy Pattern)
- [x] Add `OOO_DATA_FETCHER` token (Strategy Pattern)
- [x] Keep `WEBHOOK_TOKENS` name (no rename needed)
- [x] Import in main tokens: `import { WEBHOOK_TOKENS } from "./webhooks/Webhooks.tokens"`
- [x] Add to DI_TOKENS: `...WEBHOOK_TOKENS`
- [x] Test: All tokens accessible

**Files:**
- `packages/features/di/webhooks/Webhooks.tokens.ts` ✅
- `packages/features/di/tokens.ts` ✅

### 0.6 Main Container Integration

**Update Main Container:**
- [x] Import producer and consumer modules
- [x] Add `getWebhookProducerService()` convenience export
- [x] Add `getWebhookTaskConsumer()` convenience export
- [x] Keep existing service exports (backward compat)
- [x] Add documentation comments

**Files:**
- `packages/features/di/webhooks/containers/webhook.ts` ✅

### 0.7 File Cleanup

- [x] Verified no duplicate files exist
- [x] No stale imports found

**Files:**
- N/A (no duplicates found)

### 0.8 Facade Pattern

**Create Facade:**
- [x] Create `packages/features/webhooks/lib/facade/WebhookFeature.ts`
- [x] Define `WebhookFeature` interface with all services
- [x] Export `getWebhookFeature()` from main container
- [x] Add type annotations to all getters
- [x] Test: Facade returns all services

**Files:**
- `packages/features/webhooks/lib/facade/WebhookFeature.ts` ✅
- `packages/features/di/webhooks/containers/webhook.ts` ✅

### 0.9 Payload Compatibility Validation ⚠️ CRITICAL

**Create Payload Comparison Tests:**
- [x] Create `packages/features/webhooks/lib/service/__tests__/payload-compatibility.test.ts`
- [x] Create `packages/features/webhooks/lib/service/__tests__/fixtures.ts`
- [x] Create `packages/features/webhooks/lib/service/__tests__/README.md`
- [x] Set up test framework for comparing payloads

**Validate Each Trigger Event (Scaffolded):**
- [x] `BOOKING_CREATED` - test scaffold ready
- [x] `BOOKING_CANCELLED` - test scaffold ready
- [x] `BOOKING_RESCHEDULED` - test scaffold ready
- [x] `BOOKING_CONFIRMED` - test scaffold ready
- [x] `BOOKING_REJECTED` - test scaffold ready
- [x] `BOOKING_PAYMENT_INITIATED` - test scaffold ready
- [x] `BOOKING_PAID` - test scaffold ready
- [x] `BOOKING_NO_SHOW_UPDATED` - test scaffold ready
- [x] `FORM_SUBMITTED` - test scaffold ready
- [x] `RECORDING_READY` - test scaffold ready
- [x] `OOO_CREATED` - test scaffold ready

**Note:** Full payload validation will be implemented in Phase 1+ when Consumer data fetching is complete. Scaffolds ensure test structure is ready.

**Files:**
- `packages/features/webhooks/lib/service/__tests__/payload-compatibility.test.ts` ✅
- `packages/features/webhooks/lib/service/__tests__/fixtures.ts` ✅
- `packages/features/webhooks/lib/service/__tests__/README.md` ✅

### 0.10 Testing Infrastructure

**Producer Tests:**
- [x] Unit tests for `WebhookTaskerProducerService`
- [x] Test all queue methods
- [x] Test operationId generation
- [x] Test error handling
- [x] Mock Tasker and Logger
- [x] All 20 tests passing

**Consumer Tests:**
- [x] Unit tests for `WebhookTaskConsumer`
- [x] Test basic processing flow with Strategy Pattern
- [x] Test data fetcher selection via `canHandle()`
- [x] Test subscriber fetching via fetcher `getSubscriberContext()`
- [x] Test error handling
- [x] Mock all dependencies (repository + data fetchers array)
- [x] All 14 tests passing
- [ ] Full data fetching tests (Phase 1+)
- [ ] Payload building tests (Phase 1+)
- [ ] HTTP delivery tests (Phase 1+)

**Container Tests:**
- [x] Services resolvable via container
- [x] Prisma injection works
- [x] Producer/consumer accessible
- [x] All 5 data fetchers resolvable

**Test Summary:**
- ✅ 34 webhook tests passing (20 producer + 14 consumer)
- ✅ Zero type errors in webhooks package
- ✅ All mocks using proper Strategy Pattern

**Files:**
- `packages/features/webhooks/lib/service/__tests__/WebhookTaskerProducerService.test.ts` ✅
- `packages/features/webhooks/lib/service/__tests__/WebhookTaskConsumer.test.ts` ✅ (updated for Strategy Pattern)

### 0.11 Tasker Task Handler Registration

**Register Handler:**
- [x] Create `packages/features/tasker/tasks/webhookDelivery.ts`
- [x] Register task type: `"webhookDelivery"`
- [x] Handler calls `getWebhookTaskConsumer().processWebhookTask()`
- [x] Add error handling with logger
- [x] Add to tasker registry with retry logic
- [x] Validate taskId is required

**Files:**
- `packages/features/tasker/tasks/webhookDelivery.ts` ✅
- `packages/features/tasker/tasks/index.ts` ✅
- `packages/features/tasker/tasker.ts` ✅

### Phase 0 Completion Checklist

- [x] All services resolvable from container
- [x] Prisma injected via DI (singleton kept for Phase 1.1)
- [x] `WEBHOOK_TOKENS` in main `DI_TOKENS`
- [x] `getWebhookFeature()` returns working facade
- [x] `getWebhookProducerService()` returns producer
- [x] `getWebhookTaskConsumer()` returns consumer
- [x] Producer can queue webhook tasks
- [x] Consumer implements **Strategy Pattern** for SOLID/DIP compliance
- [x] **5 Data Fetchers** implemented (Booking, Payment, Form, Recording, OOO)
- [x] **OCP Compliance**: Add new webhook types without modifying consumer code
- [x] **SRP Compliance**: Consumer orchestrates, fetchers own domain logic
- [x] **DIP Compliance**: Consumer depends on `IWebhookDataFetcher` interface
- [x] Payload compatibility tests scaffolded (full validation Phase 1+)
- [x] Tasker handler registered for "webhookDelivery" with retry logic
- [x] No duplicate files in DI folder
- [x] All tests passing (34 unit tests: 20 producer + 14 consumer)
- [x] Type checks pass (zero errors in webhooks package)
- [x] Build passes
- [x] Zero production impact (no live code touched)

**✅ COMPLETE:** Phase 0 infrastructure is ready with **full SOLID/DIP compliance**. Producer/Consumer pattern implemented with Strategy Pattern for extensibility. Facade pattern implemented. Testing infrastructure complete. Ready for Phase 1 wiring with confidence.

**Key Achievement**: Resolved architectural debt by implementing Strategy Pattern **before** Phase 1 wiring, ensuring clean, maintainable, SOLID-compliant architecture from the start.

**Actual Time:** 3 days

---

## Phase 1: Core BookingWebhookService (#23238)

**Status:** ⏸️ Not Started  
**Estimated Duration:** 1 week  
**Dependencies:** Phase 0  
**GitHub Issue:** #23238

### 1.1 Create Operations Layer

- [ ] `send-booking-created-webhook.controller.ts` + tests
- [ ] `send-booking-cancelled-webhook.controller.ts` + tests
- [ ] `send-booking-rescheduled-webhook.controller.ts` + tests
- [ ] `send-booking-confirmed-webhook.controller.ts` + tests
- [ ] `send-booking-payment-webhook.controller.ts` + tests

**Files:**
- `packages/features/webhooks/operations/*.controller.ts` (5 new files)
- `packages/features/webhooks/operations/*.controller.test.ts` (5 new files)

### 1.2 Migrate Core Booking Files

- [ ] `packages/features/bookings/lib/handleWebhookTrigger.ts`
- [ ] `packages/features/bookings/lib/handleConfirmation.ts`
- [ ] `packages/features/bookings/lib/handleCancelBooking.ts`
- [ ] `packages/features/bookings/lib/handleBookingRequested.ts`
- [ ] `packages/features/bookings/lib/service/RegularBookingService.ts`
- [ ] `packages/features/bookings/lib/service/InstantBookingCreateService.ts`

### 1.3 Migrate TRPC Handlers

- [ ] `packages/trpc/server/routers/viewer/bookings/confirm.handler.ts`
- [ ] `packages/trpc/server/routers/viewer/bookings/requestReschedule.handler.ts`

### 1.4 Migrate Seats Handling

- [ ] `packages/features/bookings/lib/handleSeats/handleSeats.ts`
- [ ] `packages/features/bookings/lib/handleSeats/cancel/cancelAttendeeSeat.ts`

### 1.5 Testing & Validation

- [ ] All migrated files have updated tests
- [ ] Integration tests pass
- [ ] Manual testing in staging
- [ ] Webhook delivery metrics unchanged
- [ ] No errors in logs

### Phase 1 Completion Checklist

- [ ] 5 operations implemented with tests
- [ ] 10-12 files migrated
- [ ] All tests passing
- [ ] Staging validation complete
- [ ] No production issues
- [ ] Metrics show no degradation
- [ ] PR reviewed and merged

**Files Migrated:** ~10-12 files

---

## Phase 2: NoShow + Remaining BookingWebhookService (#23239)

**Status:** ⏸️ Not Started  
**Estimated Duration:** 3-4 days  
**Dependencies:** Phase 0  
**GitHub Issue:** #23239

### 2.1 Create NoShow Operations

- [ ] `send-booking-noshow-webhook.controller.ts` + tests
- [ ] `schedule-noshow-webhook.controller.ts` + tests
- [ ] `send-booking-rejected-webhook.controller.ts` + tests

**Files:**
- `packages/features/webhooks/operations/*.controller.ts` (3 new files)

### 2.2 Migrate NoShow Handling

- [ ] `packages/features/handleMarkNoShow.ts`
- [ ] `packages/features/bookings/lib/handleNewBooking/scheduleNoShowTriggers.ts`
- [ ] `packages/features/bookings/lib/handleNewBooking/scheduleNoShowTriggers.integration-test.ts`

### 2.3 Migrate Tasker Jobs

- [ ] `packages/features/tasker/tasks/triggerNoShow/common.ts`

### 2.4 Migrate Daily Webhook Handler

- [ ] `apps/web/lib/daily-webhook/triggerWebhooks.ts`

### 2.5 Testing & Validation

- [ ] All tests passing
- [ ] NoShow webhooks work in staging
- [ ] Scheduled triggers work correctly

### Phase 2 Completion Checklist

- [ ] 3 operations implemented with tests
- [ ] 5-7 files migrated
- [ ] All tests passing
- [ ] Staging validation complete
- [ ] PR reviewed and merged

**Files Migrated:** ~5-7 files

---

## Phase 3: OOOWebhookService (#23240)

**Status:** ⏸️ Not Started  
**Estimated Duration:** 2-3 days  
**Dependencies:** Phase 0  
**GitHub Issue:** #23240

### 3.1 Create OOO Operations

- [ ] `send-ooo-created-webhook.controller.ts` + tests
- [ ] `send-ooo-deleted-webhook.controller.ts` + tests

**Files:**
- `packages/features/webhooks/operations/*.controller.ts` (2 new files)

### 3.2 Migrate OOO Handlers

- [ ] `packages/trpc/server/routers/viewer/ooo/outOfOfficeCreateOrUpdate.handler.ts`
- [ ] Other OOO-related handlers (if any)

### 3.3 Testing & Validation

- [ ] All tests passing
- [ ] OOO webhooks work in staging

### Phase 3 Completion Checklist

- [ ] 2 operations implemented with tests
- [ ] 2-3 files migrated
- [ ] All tests passing
- [ ] Staging validation complete
- [ ] PR reviewed and merged

**Files Migrated:** ~2-3 files

---

## Phase 4: FormWebhookService (#23241)

**Status:** ⏸️ Not Started  
**Estimated Duration:** 2-3 days  
**Dependencies:** Phase 0  
**GitHub Issue:** #23241

### 4.1 Create Form Operations

- [ ] `send-form-submitted-webhook.controller.ts` + tests
- [ ] `send-form-submitted-no-event-webhook.controller.ts` + tests

**Files:**
- `packages/features/webhooks/operations/*.controller.ts` (2 new files)

### 4.2 Migrate Form Submission Handlers

- [ ] `packages/app-store/routing-forms/lib/formSubmissionUtils.ts`
- [ ] `packages/app-store/routing-forms/lib/formSubmissionUtils.test.ts`

### 4.3 Migrate Tasker Jobs

- [ ] `packages/features/tasker/tasks/triggerFormSubmittedNoEvent/triggerFormSubmittedNoEventWebhook.ts`

### 4.4 Testing & Validation

- [ ] All tests passing
- [ ] Form webhooks work in staging
- [ ] Routing forms work correctly

### Phase 4 Completion Checklist

- [ ] 2 operations implemented with tests
- [ ] 3-4 files migrated
- [ ] All tests passing
- [ ] Routing forms tested
- [ ] PR reviewed and merged

**Files Migrated:** ~3-4 files

---

## Phase 5: RecordingWebhookService (#23242)

**Status:** ⏸️ Not Started  
**Estimated Duration:** 2-3 days  
**Dependencies:** Phase 0  
**GitHub Issue:** #23242

### 5.1 Create Recording Operations

- [ ] `send-recording-ready-webhook.controller.ts` + tests
- [ ] `send-transcription-generated-webhook.controller.ts` + tests

**Files:**
- `packages/features/webhooks/operations/*.controller.ts` (2 new files)

### 5.2 Identify Recording Usage

- [ ] Search codebase for recording webhook usage
- [ ] Document all files using recording webhooks
- [ ] Plan migration strategy

### 5.3 Migrate Recording Handlers

- [ ] Migrate identified files (TBD after search)
- [ ] Update tests

### 5.4 Testing & Validation

- [ ] All tests passing
- [ ] Recording webhooks work in staging

### Phase 5 Completion Checklist

- [ ] 2 operations implemented with tests
- [ ] All recording files migrated
- [ ] All tests passing
- [ ] Staging validation complete
- [ ] PR reviewed and merged

**Files Migrated:** ~2-3 files

---

## Phase 6: Clean up Legacy Code (#23243)

**Status:** ⏸️ Not Started  
**Estimated Duration:** 3-4 days (after 2-week deprecation period)  
**Dependencies:** Phases 1-5 complete  
**GitHub Issue:** #23243

### 6.1 Mark Legacy Code as Deprecated

- [ ] Add `@deprecated` to `getWebhooks()`
- [ ] Add `@deprecated` to `sendPayload()`
- [ ] Add `@deprecated` to `sendOrSchedulePayload()`
- [ ] Add `@deprecated` to `schedulePayload()`
- [ ] Add `@deprecated` to `handleWebhookTrigger()`
- [ ] Add runtime warnings in dev/staging
- [ ] Update IDE hints for deprecated functions

**Files:**
- `packages/features/webhooks/lib/getWebhooks.ts`
- `packages/features/webhooks/lib/sendPayload.ts`
- `packages/features/webhooks/lib/sendOrSchedulePayload.ts`
- `packages/features/webhooks/lib/schedulePayload.ts`
- `packages/features/bookings/lib/handleWebhookTrigger.ts`

### 6.2 Deprecation Period (2 weeks)

- [ ] Monitor for any usage of deprecated functions
- [ ] Update any stragglers
- [ ] Verify zero new usage in PRs
- [ ] Communicate deprecation to team

### 6.3 Remove Legacy Functions

- [ ] Delete `packages/features/webhooks/lib/getWebhooks.ts`
- [ ] Delete `packages/features/webhooks/lib/sendPayload.ts`
- [ ] Delete `packages/features/webhooks/lib/sendOrSchedulePayload.ts`
- [ ] Delete `packages/features/webhooks/lib/schedulePayload.ts`
- [ ] Delete `packages/features/bookings/lib/handleWebhookTrigger.ts`

### 6.4 Clean Up Tests

- [ ] Remove tests for deprecated functions
- [ ] Update remaining tests
- [ ] Ensure 100% coverage for operations

### 6.5 Remove Backward Compatibility

- [ ] Remove individual getter functions (optional)
- [ ] Remove `WEBHOOK_TOKENS` alias (optional)
- [ ] Clean up temporary migration code

### 6.6 Update Documentation

- [ ] Update README files
- [ ] Update code examples
- [ ] Mark migration guide as complete
- [ ] Add to changelog

### 6.7 Final Verification

- [ ] Run full test suite
- [ ] Run type checks: `yarn type-check:ci --force`
- [ ] Verify build: `yarn build`
- [ ] Search for any remaining old imports
- [ ] Monitor production for 1 week

### Phase 6 Completion Checklist

- [ ] All legacy functions marked deprecated (2 weeks ago)
- [ ] All legacy files deleted
- [ ] No remaining imports of old patterns
- [ ] Build succeeds
- [ ] All tests passing (100% coverage)
- [ ] Documentation updated
- [ ] Changelog updated
- [ ] Zero production issues for 1 week
- [ ] 100% DI compliance achieved! 🎉

**Files Deleted:**
- `packages/features/webhooks/lib/getWebhooks.ts`
- `packages/features/webhooks/lib/sendPayload.ts`
- `packages/features/webhooks/lib/sendOrSchedulePayload.ts`
- `packages/features/webhooks/lib/schedulePayload.ts`
- `packages/features/bookings/lib/handleWebhookTrigger.ts`
- Related test files

---

## Progress Tracking

### Overall Status

```
┌─────────────────────────────────────────┐
│ Webhooks DI Wiring Progress             │
├─────────────────────────────────────────┤
│ Phase 0: Infrastructure        ⏸️ 0%    │
│ Phase 1: Core Booking         ⏸️ 0%    │
│ Phase 2: NoShow               ⏸️ 0%    │
│ Phase 3: OOO                  ⏸️ 0%    │
│ Phase 4: Form                 ⏸️ 0%    │
│ Phase 5: Recording            ⏸️ 0%    │
│ Phase 6: Cleanup              ⏸️ 0%    │
├─────────────────────────────────────────┤
│ Overall Progress:             0%        │
└─────────────────────────────────────────┘
```

### Files Migrated

- **Total Files**: ~25-30
- **Migrated**: 0
- **Remaining**: ~25-30

### Test Coverage

- **Operations**: 0% (0/0 operations implemented)
- **Integration**: TBD
- **E2E**: TBD

### Production Metrics

- **Success Rate**: Baseline TBD
- **Latency (p95)**: Baseline TBD
- **Error Rate**: Baseline TBD

---

## Quick Commands

### Type Check
```bash
yarn type-check:ci --force
```

### Run Tests
```bash
# All webhook tests
yarn test packages/features/webhooks

# Specific file
yarn test packages/features/webhooks/operations/send-booking-webhook.controller.test.ts
```

### Search for Old Patterns
```bash
# Find usage of getWebhooks
rg "import.*getWebhooks" --type ts

# Find usage of sendPayload
rg "import.*sendPayload" --type ts
```

### Build
```bash
yarn build
```

---

## Notes

- Update this file as phases progress
- Move status from ⏸️ → 🚧 → ✅
- Track any blockers with ⚠️
- Document decisions and learnings
- Keep GitHub issues in sync

---

**Last Updated:** December 15, 2025  
**Current Phase:** Phase 0 (Not Started)
