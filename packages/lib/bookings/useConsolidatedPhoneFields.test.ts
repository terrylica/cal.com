/**
 * @vitest-environment jsdom
 */
import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useConsolidatedPhoneFields } from "./useConsolidatedPhoneFields";

const createField = (name: string, overrides: Record<string, unknown> = {}) => ({
  name,
  type: "phone" as const,
  label: name,
  required: false,
  hidden: false,
  sources: [],
  ...overrides,
});

describe("useConsolidatedPhoneFields", () => {
  describe("when enabled (default)", () => {
    it("should consolidate multiple system phone fields into one", () => {
      const fields = [
        createField("name", { type: "text" }),
        createField("attendeePhoneNumber"),
        createField("email", { type: "email" }),
        createField("smsReminderNumber"),
      ];

      const { result } = renderHook(() => useConsolidatedPhoneFields(fields));

      expect(result.current.isConsolidated).toBe(true);
      expect(result.current.displayFields).toHaveLength(3); // name, consolidated phone, email
      expect(result.current.displayFields[1].name).toBe("attendeePhoneNumber"); // canonical field
      expect(result.current.displayFields[1]._consolidatedFrom).toEqual([
        "attendeePhoneNumber",
        "smsReminderNumber",
      ]);
    });

    it("should not consolidate when only one system phone field exists", () => {
      const fields = [
        createField("name", { type: "text" }),
        createField("attendeePhoneNumber"),
        createField("email", { type: "email" }),
      ];

      const { result } = renderHook(() => useConsolidatedPhoneFields(fields));

      expect(result.current.isConsolidated).toBe(false);
      expect(result.current.displayFields).toHaveLength(3);
      expect(result.current.phoneFieldIndices).toBeNull();
    });

    it("should not consolidate when no system phone fields exist", () => {
      const fields = [
        createField("name", { type: "text" }),
        createField("customPhone", { type: "phone" }), // not a system phone field
        createField("email", { type: "email" }),
      ];

      const { result } = renderHook(() => useConsolidatedPhoneFields(fields));

      expect(result.current.isConsolidated).toBe(false);
      expect(result.current.displayFields).toHaveLength(3);
    });

    it("should use attendeePhoneNumber as canonical field when present", () => {
      const fields = [
        createField("smsReminderNumber"),
        createField("attendeePhoneNumber"),
        createField("aiAgentCallPhoneNumber"),
      ];

      const { result } = renderHook(() => useConsolidatedPhoneFields(fields));

      expect(result.current.displayFields[0].name).toBe("attendeePhoneNumber");
    });

    it("should mark consolidated field as required if any source is required", () => {
      const fields = [
        createField("attendeePhoneNumber", { required: false }),
        createField("smsReminderNumber", { required: true }),
      ];

      const { result } = renderHook(() => useConsolidatedPhoneFields(fields));

      expect(result.current.displayFields[0].required).toBe(true);
    });

    it("should mark consolidated field as hidden only if all sources are hidden", () => {
      const fields = [
        createField("attendeePhoneNumber", { hidden: true }),
        createField("smsReminderNumber", { hidden: false }),
      ];

      const { result } = renderHook(() => useConsolidatedPhoneFields(fields));

      expect(result.current.displayFields[0].hidden).toBe(false);
    });

    it("should mark consolidated field as hidden when all sources are hidden", () => {
      const fields = [
        createField("attendeePhoneNumber", { hidden: true }),
        createField("smsReminderNumber", { hidden: true }),
      ];

      const { result } = renderHook(() => useConsolidatedPhoneFields(fields));

      expect(result.current.displayFields[0].hidden).toBe(true);
    });

    it("should provide phoneFieldIndices map for syncing", () => {
      const fields = [
        createField("name", { type: "text" }),
        createField("attendeePhoneNumber"),
        createField("smsReminderNumber"),
      ];

      const { result } = renderHook(() => useConsolidatedPhoneFields(fields));

      expect(result.current.phoneFieldIndices).toBeInstanceOf(Map);
      expect(result.current.phoneFieldIndices?.get("attendeePhoneNumber")).toBe(1);
      expect(result.current.phoneFieldIndices?.get("smsReminderNumber")).toBe(2);
    });

    it("should consolidate all three system phone fields", () => {
      const fields = [
        createField("attendeePhoneNumber"),
        createField("smsReminderNumber"),
        createField("aiAgentCallPhoneNumber"),
      ];

      const { result } = renderHook(() => useConsolidatedPhoneFields(fields));

      expect(result.current.isConsolidated).toBe(true);
      expect(result.current.displayFields).toHaveLength(1);
      expect(result.current.displayFields[0]._consolidatedFrom).toEqual([
        "attendeePhoneNumber",
        "smsReminderNumber",
        "aiAgentCallPhoneNumber",
      ]);
    });
  });

  describe("when disabled", () => {
    it("should return original fields unchanged", () => {
      const fields = [
        createField("attendeePhoneNumber"),
        createField("smsReminderNumber"),
        createField("aiAgentCallPhoneNumber"),
      ];

      const { result } = renderHook(() => useConsolidatedPhoneFields(fields, { enabled: false }));

      expect(result.current.isConsolidated).toBe(false);
      expect(result.current.displayFields).toHaveLength(3);
      expect(result.current.displayFields).toEqual(fields);
      expect(result.current.phoneFieldIndices).toBeNull();
      expect(result.current.phoneFields).toBeNull();
    });

    it("should not consolidate even with multiple system phone fields", () => {
      const fields = [
        createField("name", { type: "text" }),
        createField("attendeePhoneNumber"),
        createField("smsReminderNumber"),
      ];

      const { result } = renderHook(() => useConsolidatedPhoneFields(fields, { enabled: false }));

      expect(result.current.isConsolidated).toBe(false);
      expect(result.current.displayFields).toHaveLength(3);
      expect(result.current.displayFields[1].name).toBe("attendeePhoneNumber");
      expect(result.current.displayFields[2].name).toBe("smsReminderNumber");
    });
  });
});
