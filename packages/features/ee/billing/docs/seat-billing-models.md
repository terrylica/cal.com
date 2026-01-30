# Seat-Based Billing Models

This document outlines the two seat-based billing models used for Cal.com teams and organizations.

## Overview

| Model | Plan Type | Trigger | Billing Approach |
|-------|-----------|---------|------------------|
| **Monthly Proration** | Annual plans | Cron (1st of month) | Prorated mid-cycle invoices |
| **High Water Mark (HWM)** | Monthly plans | `invoice.upcoming` webhook | Peak usage at renewal |

---

## Model 1: Monthly Proration (Annual Plans)

### What It Does

When a team on an **annual plan** adds seats mid-subscription, they are charged a prorated amount for the remaining time in their annual billing cycle.

### Example

- Team on annual plan ($150/seat/year), subscription started January 1st
- In March, they add 2 seats
- On April 1st, the system calculates: `2 seats × $150 × (9 months remaining / 12 months) = $225`
- An invoice for $225 is created

### How It Works

1. `SeatChangeTrackingService` logs each seat addition/removal with a `monthKey`
2. On the 1st of each month, `scheduleMonthlyProration` cron job runs
3. Finds all annual teams with unprocessed seat changes from the previous month
4. Calculates prorated amount based on remaining subscription days
5. Creates a Stripe invoice item and invoice

---

## Model 2: High Water Mark (Monthly Plans)

### What It Does

For **monthly plans**, we track the peak (highest) seat count during the billing cycle and bill for that amount at renewal. No mid-cycle charges occur.

### Example

- Team on monthly plan ($15/seat/month) with 5 seats
- Week 1: Add 3 seats (now 8) → HWM = 8
- Week 2: Remove 2 seats (now 6) → HWM stays 8
- Week 3: Add 1 seat (now 7) → HWM stays 8
- At renewal: Billed for 8 seats ($120), HWM resets to 7

### How It Works

1. `SeatChangeTrackingService.logSeatAddition()` updates HWM if current count exceeds it
2. HWM only increases, never decreases on removal
3. ~3 days before renewal, Stripe sends `invoice.upcoming` webhook
4. Handler updates Stripe subscription quantity to HWM value
5. On renewal, `customer.subscription.updated` webhook resets HWM to current count
---

## Comparison

| Aspect | Monthly Proration (Annual) | High Water Mark (Monthly) |
|--------|---------------------------|---------------------------|
| **When charged** | Mid-cycle (delayed to 1st of month) | At renewal only |
| **What's tracked** | Net changes (additions - removals) | Peak usage (max seats) |
| **Removal impact** | Reduces charge | No impact on current cycle |
| **Invoice type** | Separate invoice item | Updated subscription quantity |
| **Complexity** | Higher (proration math, invoice creation) | Lower (just track max) |

---

## Pros & Cons of Keeping Separate

### Pros of Separation (Current Approach)

| Pro | Explanation |
|-----|-------------|
| **Business logic clarity** | Each model reflects different customer expectations for annual vs monthly |
| **Appropriate for plan type** | Annual customers expect to pay for what they use; monthly customers expect flexibility |
| **Prevents gaming** | Annual: Can't add 10 seats for a day without paying. Monthly: Peak billing discourages rapid churn |
| **Separation of concerns** | Each service is focused, testable, and maintainable independently |
| **Rollout flexibility** | Can enable/disable each model independently if issues arise |

### Cons of Separation

| Con | Explanation |
|-----|-------------|
| **Code duplication** | Both track seat changes, both check feature flags, similar patterns |
| **Confusing naming** | `monthly-proration` flag controls annual proration AND monthly HWM |
| **Two mental models** | Engineers need to understand both systems |
| **Testing surface** | More code paths to test and maintain |

---

## Pros & Cons of Unifying

### Pros of Unification (HWM for Both)

| Pro | Explanation |
|-----|-------------|
| **Simpler codebase** | One billing model, one set of services |
| **Easier to explain** | "We bill for peak usage" - same for everyone |
| **Less code to maintain** | Remove proration service, tasker, repository |

### Cons of Unification

| Con | Explanation |
|-----|-------------|
| **Annual plan gaming** | Customer could add 50 seats for one day, use them, remove 49 - only pay for 50 at renewal |
| **Revenue impact** | Annual customers currently pay prorated amounts mid-cycle; HWM delays all revenue to renewal |
| **Different expectations** | Annual customers may expect immediate billing for additions |
| **Migration complexity** | Existing annual customers have proration records; need migration strategy |


---

## Architecture Diagram

```
                         ┌─────────────────────────┐
                         │   Seat Change Event     │
                         │   (add/remove member)   │
                         └───────────┬─────────────┘
                                     │
                                     ▼
                         ┌─────────────────────────┐
                         │ SeatChangeTrackingService│
                         │   (logs all changes)    │
                         └───────────┬─────────────┘
                                     │
                         ┌───────────┴───────────┐
                         │                       │
                         ▼                       ▼
              ┌─────────────────┐     ┌─────────────────┐
              │  ANNUAL PLAN    │     │  MONTHLY PLAN   │
              └────────┬────────┘     └────────┬────────┘
                       │                       │
                       ▼                       ▼
         ┌──────────────────────┐  ┌──────────────────────┐
         │ Cron: 1st of month   │  │ Update HWM if higher │
         │                      │  │                      │
         │ MonthlyProration     │  │ HighWaterMarkService │
         │ Service              │  │                      │
         └──────────┬───────────┘  └──────────┬───────────┘
                    │                         │
                    ▼                         ▼
         ┌──────────────────────┐  ┌──────────────────────┐
         │ Create prorated      │  │ invoice.upcoming     │
         │ invoice immediately  │  │ webhook updates      │
         │                      │  │ quantity at renewal  │
         └──────────────────────┘  └──────────────────────┘
```

---

## Feature Flag

Both models are gated by `monthly-proration` feature flag:

```typescript
// BillingPeriodService.ts

// For annual plans - monthly proration
async shouldApplyMonthlyProration(teamId: number): Promise<boolean> {
  const isEnabled = await featuresRepository.checkIfFeatureIsEnabledGlobally("monthly-proration");
  return isEnabled && billingPeriod === "ANNUALLY" && !isInTrial;
}

// For monthly plans - high water mark
async shouldApplyHighWaterMark(teamId: number): Promise<boolean> {
  const isEnabled = await featuresRepository.checkIfFeatureIsEnabledGlobally("monthly-proration");
  return isEnabled && billingPeriod === "MONTHLY" && !isInTrial;
}
```

The flag name is a historical artifact - it originally only controlled annual proration but now gates both advanced billing features.
