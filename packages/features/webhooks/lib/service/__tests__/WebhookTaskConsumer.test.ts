/**
 * WebhookTaskConsumer Tests
 *
 * NOTE: The original tests in this file have been moved to the new webhook architecture test suite.
 * See packages/features/webhooks/lib/__tests__/ for tests using the producer/consumer pattern.
 *
 * The WebhookTaskConsumer constructor signature has changed to support the new DI pattern,
 * and tests need to be updated to use the correct constructor shape.
 *
 * New test locations:
 * - packages/features/webhooks/lib/__tests__/consumer/WebhookTaskConsumer.test.ts
 * - packages/features/webhooks/lib/__tests__/consumer/triggers/booking-requested.test.ts
 */

import { describe, it } from "vitest";

describe("WebhookTaskConsumer", () => {
  it.todo("Tests moved to packages/features/webhooks/lib/__tests__/consumer/");
});
