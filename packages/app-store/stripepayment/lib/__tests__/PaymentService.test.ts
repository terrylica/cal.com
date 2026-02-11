import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import type { Prisma } from "@calcom/prisma/client";

const mockPaymentIntentCreate = vi.fn();

vi.mock("stripe", () => {
  function StripeMock() {
    return {
      paymentIntents: { create: mockPaymentIntentCreate },
      customers: {
        list: vi.fn().mockResolvedValue({ data: [{ id: "cus_test_123" }] }),
        create: vi.fn().mockResolvedValue({ id: "cus_new_123" }),
      },
    };
  }
  return { default: StripeMock };
});

vi.mock("../server", () => ({
  default: {
    customers: {
      list: vi.fn().mockResolvedValue({ data: [{ id: "cus_test_123" }] }),
      create: vi.fn().mockResolvedValue({ id: "cus_new_123" }),
    },
  },
}));

vi.mock("../customer", () => ({
  retrieveOrCreateStripeCustomerByEmail: vi.fn().mockResolvedValue({ id: "cus_test_123" }),
}));

vi.mock("@calcom/prisma", () => ({
  default: {
    payment: {
      create: vi.fn().mockResolvedValue({
        id: 1,
        uid: "test-uid",
        amount: 1000,
        currency: "usd",
        externalId: "pi_test_123",
        fee: 0,
        refunded: false,
        success: false,
      }),
    },
  },
}));

vi.mock("@calcom/features/bookings/repositories/BookingRepository");
vi.mock("@calcom/features/tasker", () => ({
  default: { create: vi.fn() },
}));
vi.mock("@calcom/lib/logger", () => ({
  default: { getSubLogger: () => ({ error: vi.fn(), info: vi.fn() }) },
}));

import { BuildPaymentService } from "../PaymentService";

function createValidCredentials(): { key: Prisma.JsonValue } {
  return {
    key: {
      stripe_user_id: "acct_test_123",
      default_currency: "usd",
      stripe_publishable_key: "pk_test_123",
    },
  };
}

describe("StripePaymentService - Application Fee", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.PAYMENT_FEE_PERCENTAGE;
    delete process.env.PAYMENT_FEE_FIXED;

    mockPaymentIntentCreate.mockResolvedValue({
      id: "pi_test_123",
      amount: 1000,
      currency: "usd",
      status: "requires_payment_method",
    });
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe("create() - ON_BOOKING payments", () => {
    it("should not include application_fee_amount when env vars are not set", async () => {
      const service = BuildPaymentService(createValidCredentials());

      await service.create(
        { amount: 1000, currency: "usd" },
        1,
        1,
        "testuser",
        "Test Booker",
        "ON_BOOKING",
        "booker@example.com"
      );

      expect(mockPaymentIntentCreate).toHaveBeenCalledWith(
        expect.not.objectContaining({ application_fee_amount: expect.anything() }),
        expect.objectContaining({ stripeAccount: "acct_test_123" })
      );
    });

    it("should include application_fee_amount when PAYMENT_FEE_PERCENTAGE is set", async () => {
      process.env.PAYMENT_FEE_PERCENTAGE = "0.05";

      const service = BuildPaymentService(createValidCredentials());

      await service.create(
        { amount: 1000, currency: "usd" },
        1,
        1,
        "testuser",
        "Test Booker",
        "ON_BOOKING",
        "booker@example.com"
      );

      expect(mockPaymentIntentCreate).toHaveBeenCalledWith(
        expect.objectContaining({ application_fee_amount: 50 }),
        expect.objectContaining({ stripeAccount: "acct_test_123" })
      );
    });

    it("should include application_fee_amount when PAYMENT_FEE_FIXED is set", async () => {
      process.env.PAYMENT_FEE_FIXED = "25";

      const service = BuildPaymentService(createValidCredentials());

      await service.create(
        { amount: 1000, currency: "usd" },
        1,
        1,
        "testuser",
        "Test Booker",
        "ON_BOOKING",
        "booker@example.com"
      );

      expect(mockPaymentIntentCreate).toHaveBeenCalledWith(
        expect.objectContaining({ application_fee_amount: 25 }),
        expect.objectContaining({ stripeAccount: "acct_test_123" })
      );
    });

    it("should combine percentage and fixed fee correctly", async () => {
      process.env.PAYMENT_FEE_PERCENTAGE = "0.05";
      process.env.PAYMENT_FEE_FIXED = "10";

      const service = BuildPaymentService(createValidCredentials());

      await service.create(
        { amount: 2000, currency: "usd" },
        1,
        1,
        "testuser",
        "Test Booker",
        "ON_BOOKING",
        "booker@example.com"
      );

      expect(mockPaymentIntentCreate).toHaveBeenCalledWith(
        expect.objectContaining({ application_fee_amount: 110 }),
        expect.objectContaining({ stripeAccount: "acct_test_123" })
      );
    });

    it("should round the fee to the nearest integer", async () => {
      process.env.PAYMENT_FEE_PERCENTAGE = "0.033";

      const service = BuildPaymentService(createValidCredentials());

      await service.create(
        { amount: 1000, currency: "usd" },
        1,
        1,
        "testuser",
        "Test Booker",
        "ON_BOOKING",
        "booker@example.com"
      );

      expect(mockPaymentIntentCreate).toHaveBeenCalledWith(
        expect.objectContaining({ application_fee_amount: 33 }),
        expect.objectContaining({ stripeAccount: "acct_test_123" })
      );
    });

    it("should not include fee when percentage is zero and fixed is zero", async () => {
      process.env.PAYMENT_FEE_PERCENTAGE = "0";
      process.env.PAYMENT_FEE_FIXED = "0";

      const service = BuildPaymentService(createValidCredentials());

      await service.create(
        { amount: 1000, currency: "usd" },
        1,
        1,
        "testuser",
        "Test Booker",
        "ON_BOOKING",
        "booker@example.com"
      );

      expect(mockPaymentIntentCreate).toHaveBeenCalledWith(
        expect.not.objectContaining({ application_fee_amount: expect.anything() }),
        expect.objectContaining({ stripeAccount: "acct_test_123" })
      );
    });

    it("should handle non-numeric PAYMENT_FEE_PERCENTAGE gracefully", async () => {
      process.env.PAYMENT_FEE_PERCENTAGE = "invalid";

      const service = BuildPaymentService(createValidCredentials());

      await service.create(
        { amount: 1000, currency: "usd" },
        1,
        1,
        "testuser",
        "Test Booker",
        "ON_BOOKING",
        "booker@example.com"
      );

      expect(mockPaymentIntentCreate).toHaveBeenCalledWith(
        expect.not.objectContaining({ application_fee_amount: expect.anything() }),
        expect.objectContaining({ stripeAccount: "acct_test_123" })
      );
    });

    it("should handle small percentage on large amounts", async () => {
      process.env.PAYMENT_FEE_PERCENTAGE = "0.005";

      const service = BuildPaymentService(createValidCredentials());

      await service.create(
        { amount: 50000, currency: "usd" },
        1,
        1,
        "testuser",
        "Test Booker",
        "ON_BOOKING",
        "booker@example.com"
      );

      expect(mockPaymentIntentCreate).toHaveBeenCalledWith(
        expect.objectContaining({ application_fee_amount: 250 }),
        expect.objectContaining({ stripeAccount: "acct_test_123" })
      );
    });
  });
});
