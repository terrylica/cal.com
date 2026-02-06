import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  extractPeriodStartFromInvoice,
  validateInvoiceLinesForHwm,
  handlePostRenewalReset,
} from "./hwm-webhook-utils";

const mockHandleInvoiceUpcoming = vi.fn();
const mockHandlePostRenewalReset = vi.fn();

vi.mock("../../service/billingModelStrategy/BillingModelStrategyFactory", () => ({
  getStrategyForSubscription: vi.fn(),
}));

import { getStrategyForSubscription } from "../../service/billingModelStrategy/BillingModelStrategyFactory";
const mockGetStrategy = vi.mocked(getStrategyForSubscription);

const createMockLogger = () => ({
  warn: vi.fn(),
  info: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
});

const createMockStrategy = () => ({
  handleInvoiceUpcoming: mockHandleInvoiceUpcoming,
  handlePostRenewalReset: mockHandlePostRenewalReset,
});

describe("hwm-webhook-utils", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("extractPeriodStartFromInvoice", () => {
    it("returns undefined for empty array", () => {
      const result = extractPeriodStartFromInvoice([]);
      expect(result).toBeUndefined();
    });

    it("returns undefined for null/undefined input", () => {
      // @ts-expect-error - testing edge case
      expect(extractPeriodStartFromInvoice(null)).toBeUndefined();
      // @ts-expect-error - testing edge case
      expect(extractPeriodStartFromInvoice(undefined)).toBeUndefined();
    });

    it("returns undefined when first item has no period", () => {
      const result = extractPeriodStartFromInvoice([{}]);
      expect(result).toBeUndefined();
    });

    it("returns undefined when period has no start", () => {
      // @ts-expect-error - testing edge case
      const result = extractPeriodStartFromInvoice([{ period: { end: 1234567890 } }]);
      expect(result).toBeUndefined();
    });

    it("returns period start when valid", () => {
      const timestamp = 1704067200; // 2024-01-01 00:00:00 UTC
      const result = extractPeriodStartFromInvoice([
        { period: { start: timestamp, end: timestamp + 86400 } },
      ]);
      expect(result).toBe(timestamp);
    });

    it("returns first item period start when multiple items exist", () => {
      const firstTimestamp = 1704067200;
      const secondTimestamp = 1704153600;
      const result = extractPeriodStartFromInvoice([
        { period: { start: firstTimestamp, end: firstTimestamp + 86400 } },
        { period: { start: secondTimestamp, end: secondTimestamp + 86400 } },
      ]);
      expect(result).toBe(firstTimestamp);
    });
  });

  describe("validateInvoiceLinesForHwm", () => {
    it("returns invalid for empty array and logs warning", () => {
      const mockLog = createMockLogger();
      // @ts-expect-error - mock logger
      const result = validateInvoiceLinesForHwm([], "sub_123", mockLog);

      expect(result.isValid).toBe(false);
      expect(result.periodStart).toBeUndefined();
      expect(mockLog.warn).toHaveBeenCalledWith(
        "Invoice has no line items for subscription sub_123, cannot process HWM"
      );
    });

    it("returns invalid for null input and logs warning", () => {
      const mockLog = createMockLogger();
      // @ts-expect-error - testing edge case
      const result = validateInvoiceLinesForHwm(null, "sub_456", mockLog);

      expect(result.isValid).toBe(false);
      expect(mockLog.warn).toHaveBeenCalled();
    });

    it("returns invalid when period.start is missing and logs warning", () => {
      const mockLog = createMockLogger();
      // @ts-expect-error - mock logger
      const result = validateInvoiceLinesForHwm([{ period: undefined }], "sub_789", mockLog);

      expect(result.isValid).toBe(false);
      expect(result.periodStart).toBeUndefined();
      expect(mockLog.warn).toHaveBeenCalledWith(
        "Invoice line item missing period.start for subscription sub_789, cannot process HWM"
      );
    });

    it("returns valid with periodStart when data is correct", () => {
      const mockLog = createMockLogger();
      const timestamp = 1704067200;
      const result = validateInvoiceLinesForHwm(
        [{ period: { start: timestamp, end: timestamp + 86400 } }],
        "sub_valid",
        // @ts-expect-error - mock logger
        mockLog
      );

      expect(result.isValid).toBe(true);
      expect(result.periodStart).toBe(timestamp);
      expect(mockLog.warn).not.toHaveBeenCalled();
    });
  });

  describe("handlePostRenewalReset", () => {
    it("returns failure when periodStartTimestamp is undefined", async () => {
      const mockLog = createMockLogger();
      // @ts-expect-error - mock logger
      const result = await handlePostRenewalReset("sub_123", undefined, mockLog);

      expect(result.success).toBe(false);
      expect(result.error).toBe("No period start timestamp");
      expect(mockLog.warn).toHaveBeenCalledWith(
        "No period start timestamp for subscription sub_123, skipping post-renewal reset"
      );
      expect(mockGetStrategy).not.toHaveBeenCalled();
    });

    it("returns failure when no billing record found", async () => {
      mockGetStrategy.mockResolvedValue(null);
      const mockLog = createMockLogger();

      // @ts-expect-error - mock logger
      const result = await handlePostRenewalReset("sub_unknown", 1704067200, mockLog);

      expect(result.success).toBe(false);
      expect(result.error).toBe("No billing record found");
      expect(mockLog.warn).toHaveBeenCalledWith(
        "No billing record found for subscription sub_unknown, skipping post-renewal reset"
      );
    });

    it("dispatches to strategy.handlePostRenewalReset", async () => {
      const mockStrategy = createMockStrategy();
      mockStrategy.handlePostRenewalReset.mockResolvedValue({ success: true, updated: true });
      mockGetStrategy.mockResolvedValue({
        strategy: mockStrategy,
        billingModel: "SEATS",
        billingPeriod: "MONTHLY",
      });
      const mockLog = createMockLogger();
      const timestamp = 1704067200;

      // @ts-expect-error - mock logger
      const result = await handlePostRenewalReset("sub_456", timestamp, mockLog);

      expect(result.success).toBe(true);
      expect(result.updated).toBe(true);
      expect(mockStrategy.handlePostRenewalReset).toHaveBeenCalledWith(
        { subscriptionId: "sub_456", periodStartTimestamp: timestamp },
        expect.anything()
      );
    });

    it("logs billing model info when dispatching", async () => {
      const mockStrategy = createMockStrategy();
      mockStrategy.handlePostRenewalReset.mockResolvedValue({ success: true });
      mockGetStrategy.mockResolvedValue({
        strategy: mockStrategy,
        billingModel: "ACTIVE_USERS",
        billingPeriod: "MONTHLY",
      });
      const mockLog = createMockLogger();

      // @ts-expect-error - mock logger
      await handlePostRenewalReset("sub_789", 1704067200, mockLog);

      expect(mockLog.info).toHaveBeenCalledWith(
        "Dispatching post-renewal reset to billing model strategy",
        {
          subscriptionId: "sub_789",
          billingModel: "ACTIVE_USERS",
          billingPeriod: "MONTHLY",
        }
      );
    });
  });
});
