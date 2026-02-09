# Webhook Feature - Code Standards & Review Checklist

> **CRITICAL**: Every PR MUST comply with these standards before merge. Use this as a checklist during development and code review.

---

## 🚫 **NEVER DO**

### 1. **No Placeholder Tests**
```typescript
// ❌ NEVER
it("should do something", () => {
  expect(true).toBe(true); // Placeholder
});

it("TODO: implement this test", () => {
  // ... future test plan
});

// ✅ ALWAYS
// If the feature isn't ready for testing, DON'T create the test file yet
// If you need a test scaffold, implement the actual test logic
```

**Rule**: Every test MUST have meaningful assertions. No `expect(true).toBe(true)`, no TODO tests, no placeholder tests.

---

### 2. **No Implementation Plans in Code Comments**
```typescript
// ❌ NEVER
// TODO: Implement using BookingRepository
// Pattern: bookingId → fetch booking → get user → get event type
// Steps:
// 1. const booking = await this.bookingRepository.findByUid(bookingUid);
// 2. const eventType = await this.eventTypeRepository.findById(booking.eventTypeId);
// 3. const user = await this.userRepository.findById(booking.userId);
// 4. return { booking, eventType, user, attendees };

// ✅ ALWAYS
// TODO: Implement using BookingRepository (Phase 1+)
// Or better: Just implement it now if you're writing the code
```

**Rule**: Comments describe WHAT/WHY, not HOW. Implementation plans belong in `.md` files, not runtime code. Keep TODOs concise (1 line max).

---

### 3. **No Excessive Logging**
```typescript
// ❌ NEVER
log.info("Starting process...");
log.info("Step 1 complete");
log.info("Step 2 complete");
log.info("Processing item", { id });
log.info("Task completed");

// ✅ ALWAYS
log.debug("Processing task", { taskId, triggerEvent }); // Normal flow
log.warn("Event data not found", { operationId }); // Recoverable issue
log.error("Failed to process task", { error }); // Critical failure
```

**Rule**: Use `log.debug()` for normal operations, `log.warn()` for recoverable issues, `log.error()` for failures. Reserve `log.info()` for significant events only.

**Logging Levels**:
- `debug`: Trace execution flow, development diagnostics
- `info`: Significant business events (user actions, external integrations)
- `warn`: Degraded functionality, retryable errors, missing optional data
- `error`: Critical failures requiring attention

---

### 4. **No Optional Parameters Without Runtime Validation**
```typescript
// ❌ NEVER
export async function handler(payload: string, taskId?: string): Promise<void> {
  // Using taskId without checking...
  await process(taskId); // Runtime error if undefined!
}

// ✅ ALWAYS (Pattern A: Validate at runtime)
export async function handler(payload: string, taskId?: string): Promise<void> {
  if (!taskId) {
    throw new Error("Task ID is required");
  }
  await process(taskId); // Safe
}

// ✅ ALWAYS (Pattern B: Make it required if it's required)
export async function handler(payload: string, taskId: string): Promise<void> {
  await process(taskId); // Type-safe
}
```

**Rule**: If a parameter is required, either make it non-optional OR validate at runtime. Types must match runtime behavior.

---

### 5. **No `as any` Type Casting**
```typescript
// ❌ NEVER
const result = await fetch(url) as any;
const user = getUserData() as any;
container.get(TOKEN) as any;

// ✅ ALWAYS
const result = await fetch(url); // Let TypeScript infer
const user = getUserData(); // Use proper return types
const user = container.get<IUserRepository>(TOKEN); // Type-safe generics
```

**Rule**: `as any` is FORBIDDEN. Use proper types, generics, discriminated unions, or type guards instead.

**Alternatives**:
- Use generics: `get<T>(token: symbol): T`
- Use discriminated unions: `{ type: "booking"; bookingUid: string } | { type: "form"; formId: string }`
- Use type guards: `if ("bookingUid" in payload) { /* TypeScript knows the type */ }`
- Use `unknown` + validation: `const data: unknown = JSON.parse(str); if (isValidData(data)) { /* typed */ }`

---

### 6. **No Breaking SOLID Principles**

#### **Single Responsibility Principle (SRP)**
```typescript
// ❌ NEVER
class BookingService {
  createBooking() { /* ... */ }
  sendEmail() { /* ... */ }         // Email responsibility
  logToDatabase() { /* ... */ }     // Logging responsibility
  chargePayment() { /* ... */ }     // Payment responsibility
}

// ✅ ALWAYS
class BookingService {
  constructor(
    private emailService: IEmailService,
    private auditLogger: IAuditLogger,
    private paymentService: IPaymentService
  ) {}
  
  createBooking() {
    // Delegates to specialized services
    this.emailService.send(...);
    this.paymentService.charge(...);
    this.auditLogger.log(...);
  }
}
```

#### **Open/Closed Principle (OCP)**
```typescript
// ❌ NEVER
function processWebhook(event: WebhookEvent) {
  switch (event.type) {
    case "booking": return processBooking(event);
    case "form": return processForm(event);
    // Adding new types requires modifying this function
  }
}

// ✅ ALWAYS (Strategy Pattern)
interface IWebhookHandler {
  canHandle(type: string): boolean;
  process(event: WebhookEvent): Promise<void>;
}

class WebhookProcessor {
  constructor(private handlers: IWebhookHandler[]) {}
  
  async process(event: WebhookEvent) {
    const handler = this.handlers.find(h => h.canHandle(event.type));
    await handler.process(event);
  }
}
// New types = new handler class, no modification to processor
```

#### **Dependency Inversion Principle (DIP)**
```typescript
// ❌ NEVER (depends on concrete implementation)
class BookingService {
  private prisma = new PrismaClient(); // Concrete dependency
  async create() {
    return this.prisma.booking.create(...);
  }
}

// ✅ ALWAYS (depends on interface)
class BookingService {
  constructor(private repository: IBookingRepository) {} // Interface
  async create() {
    return this.repository.create(...);
  }
}
```

---

### 7. **No Direct Repository Access in Services**
```typescript
// ❌ NEVER
class WebhookRepository {
  async getSubscribers() {
    // Directly querying user and eventType tables!
    const users = await prisma.user.findMany(...);
    const eventTypes = await prisma.eventType.findMany(...);
  }
}

// ✅ ALWAYS
class WebhookRepository {
  constructor(
    private userRepository: IUsersRepository,
    private eventTypeRepository: IEventTypesRepository
  ) {}
  
  async getSubscribers() {
    // Delegates to proper repositories
    const users = await this.userRepository.findUserTeams(...);
    const eventTypes = await this.eventTypeRepository.findParentEventTypeId(...);
  }
}
```

**Rule**: Repositories ONLY access their own table(s). Cross-table queries go through other repositories or services.

---

### 7b. **Repository Interface Location Pattern**

**CRITICAL**: Repository interfaces live at the **feature root**, NOT in consumer folders.

```typescript
// ❌ NEVER (Feature-specific interface location)
packages/features/webhooks/lib/interface/IEventTypeRepository.ts  // Wrong!
packages/features/booking-audit/lib/interface/IUserRepository.ts  // Wrong!

// ✅ ALWAYS (Central interface at feature root)
packages/features/eventtypes/eventtypes.repository.interface.ts   // Correct!
packages/features/users/users.repository.interface.ts             // Correct!
```

**When adding methods to existing repositories:**

```typescript
// 1. Check if interface exists at feature root
//    - packages/features/users/users.repository.interface.ts ✅
//    - packages/features/eventtypes/eventtypes.repository.interface.ts ✅

// 2. If interface EXISTS → Add method to central interface
export interface IUsersRepository {
  updateLastActiveAt(userId: number): Promise<User>;
  findUserTeams(userId: number): Promise<{...}>; // ← Add here
}

// 3. If interface DOESN'T EXIST → Create at feature root
// packages/features/bookings/bookings.repository.interface.ts
export interface IBookingsRepository {
  findByUid(uid: string): Promise<Booking | null>;
}

// 4. Implement in concrete repository (central, not consumer-specific)
// packages/features/users/users.repository.ts
export class UsersRepository implements IUsersRepository {
  async updateLastActiveAt(userId: number) { /* ... */ }
  async findUserTeams(userId: number) { /* ... */ }  // ← Add here
}

// 5. Bind in consumer's main module (NOT separate module file)
// packages/features/di/webhooks/modules/Webhook.module.ts
webhookModule
  .bind(WEBHOOK_TOKENS.WEBHOOK_USER_REPOSITORY)
  .toClass(UsersRepository, [DI_TOKENS.PRISMA_CLIENT]);
```

**Why this pattern?**
- ✅ **Discoverability**: Developers know where to find interfaces
- ✅ **Consistency**: All features follow same structure
- ✅ **Reusability**: Multiple consumers can use same interface/implementation
- ✅ **Single Source of Truth**: One implementation, multiple DI containers
- ✅ **No Duplication**: Don't create feature-specific repository wrappers
- ✅ **Simple DI**: Bind central repos in main module, not separate files

**Rule**: Repository interfaces ALWAYS live at `packages/features/{feature-name}/{feature-name}.repository.interface.ts`. Concrete implementations at `packages/features/{feature-name}/repositories/{FeatureName}Repository.ts` (or `{feature-name}.repository.ts`). Bind in consumer's main module, not separate module files.

---

### 8. **No Dependency Injection Violations**

#### **Always Use Ioctopus/Evyweb**
```typescript
// ❌ NEVER
import { webhookRepository } from "./WebhookRepository"; // Singleton import
const service = new WebhookService(); // Direct instantiation

// ✅ ALWAYS
import { getWebhookFeature } from "@calcom/features/di/webhooks/containers/webhook";

const { producer } = getWebhookFeature(); // DI container
```

#### **Always Inject Dependencies**
```typescript
// ❌ NEVER
class WebhookService {
  private repository = WebhookRepository.getInstance(); // Singleton
  private logger = logger.getSubLogger(...); // Direct creation
}

// ✅ ALWAYS
class WebhookService {
  constructor(
    private repository: IWebhookRepository,
    logger: ILogger
  ) {
    this.log = logger.getSubLogger({ prefix: ["WebhookService"] });
  }
}
```

#### **Always Register in DI Container**
```typescript
// ✅ ALWAYS
// 1. Define interface
export interface IWebhookService { /* ... */ }

// 2. Implement interface
export class WebhookService implements IWebhookService { /* ... */ }

// 3. Create token
export const WEBHOOK_TOKENS = {
  WEBHOOK_SERVICE: Symbol("IWebhookService"),
};

// 4. Create module
export const webhookServiceModule = createModule();
webhookServiceModule
  .bind(WEBHOOK_TOKENS.WEBHOOK_SERVICE)
  .toClass(WebhookService, [
    WEBHOOK_TOKENS.WEBHOOK_REPOSITORY,
    SHARED_TOKENS.LOGGER,
  ]);

// 5. Load in container
container.load(webhookServiceModule);
```

---

### 9. **Always Use Discriminated Unions for Type Safety**
```typescript
// ❌ NEVER
type WebhookPayload = {
  triggerEvent: WebhookTriggerEvents;
  bookingUid?: string;    // Optional
  formId?: string;        // Optional
  recordingId?: string;   // Optional
  // Hard to know which fields are required for which event
};

// ✅ ALWAYS
type WebhookPayload =
  | {
      triggerEvent: "BOOKING_CREATED";
      bookingUid: string;     // Required for booking
      eventTypeId?: number;
    }
  | {
      triggerEvent: "FORM_SUBMITTED";
      formId: string;         // Required for form
      teamId?: number;
    }
  | {
      triggerEvent: "RECORDING_READY";
      recordingId: string;    // Required for recording
      bookingUid: string;
    };

// TypeScript enforces correct fields per event type
function process(payload: WebhookPayload) {
  if (payload.triggerEvent === "BOOKING_CREATED") {
    console.log(payload.bookingUid); // ✅ Available
    console.log(payload.formId); // ❌ TypeScript error
  }
}
```

**Rule**: Prefer discriminated unions over optional properties when different variants have different requirements.

---

## 📏 **PR Size Limits**

### **HARD LIMITS**
- ✅ **≤ 500 lines changed** (additions + deletions)
- ✅ **≤ 10 files changed**
- ✅ **Single concern per PR**

### **How to Split Large Features**
```
❌ BAD: "feat: Add webhook system" (2000 lines, 30 files)

✅ GOOD:
- PR 1: "feat: Add webhook infrastructure (DI, tokens, interfaces)" (200 lines, 5 files)
- PR 2: "feat: Add webhook producer service" (150 lines, 3 files)
- PR 3: "feat: Add webhook consumer + data fetchers" (300 lines, 8 files)
- PR 4: "feat: Wire booking webhooks to producer" (100 lines, 4 files)
- PR 5: "feat: Wire form webhooks to producer" (80 lines, 3 files)
```

**Rule**: Break features into smallest meaningful units. Each PR should be reviewable in < 30 minutes.

---

## ✅ **PR Checklist**

Before submitting ANY PR, verify:

### **Code Quality**
- [ ] No `as any` type casts anywhere
- [ ] All dependencies injected via constructor
- [ ] Services registered in DI container
- [ ] Discriminated unions used for variant types
- [ ] SOLID principles followed (especially SRP, OCP, DIP)
- [ ] Repository pattern followed (no cross-table queries)
- [ ] Repository interfaces at feature root (not consumer folders)

### **Testing**
- [ ] No placeholder tests (`expect(true).toBe(true)`)
- [ ] No TODO/scaffold tests
- [ ] All tests have meaningful assertions
- [ ] Tests use proper mocks/fixtures

### **Documentation**
- [ ] No implementation plans in code comments
- [ ] TODOs are concise (1 line max)
- [ ] Complex logic has WHAT/WHY comments, not HOW

### **Logging**
- [ ] `log.debug()` for normal operations
- [ ] `log.warn()` for recoverable issues
- [ ] `log.error()` for critical failures
- [ ] No excessive `log.info()`

### **Type Safety**
- [ ] Optional parameters validated at runtime if required
- [ ] No implicit `any` types
- [ ] Types match runtime behavior

### **PR Scope**
- [ ] ≤ 500 lines changed
- [ ] ≤ 10 files changed
- [ ] Single, focused concern

### **Build & Tests**
- [ ] `yarn type-check:ci --force` passes
- [ ] `yarn vitest run <affected-tests>` passes
- [ ] `yarn lint:fix` passes
- [ ] No unrelated changes included

---

## 📚 **Additional Resources**

- **Cal.com DI Guide**: `/packages/features/di/README.md`
- **SOLID Principles**: [refactoring.guru/design-patterns/solid](https://refactoring.guru/design-patterns/solid-principles)
- **Discriminated Unions**: [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/2/narrowing.html#discriminated-unions)
- **Ioctopus Docs**: [@evyweb/ioctopus](https://github.com/evyweb-llc/ioctopus)

---

## 🎯 **Golden Rules Summary**

1. **Tests**: Real assertions only, no placeholders
2. **Comments**: Concise TODOs, no implementation plans
3. **Logging**: `debug` for normal, `error` for failures
4. **Types**: No `as any`, use discriminated unions
5. **SOLID**: SRP + OCP + DIP always
6. **DI**: Always use Ioctopus, always inject dependencies
7. **Repository Pattern**: No cross-table queries, interfaces at feature root
8. **PRs**: ≤ 500 lines, ≤ 10 files, single concern

---

**When in doubt**: Ask before merging. It's easier to get it right the first time than to clean up later.
