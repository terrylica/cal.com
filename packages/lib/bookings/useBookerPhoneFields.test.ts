/**
 * @vitest-environment jsdom
 */
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createPhoneSyncHandler, useBookerPhoneFields } from "./useBookerPhoneFields";

const createField = (name: string, overrides: Record<string, unknown> = {}) => ({
  name,
  type: "phone",
  label: name,
  required: false,
  hidden: false,
  ...overrides,
});

describe("useBookerPhoneFields", () => {
  describe("when enabled (default)", () => {
    it("should consolidate multiple system phone fields into one", () => {
      const fields = [
        createField("name", { type: "text" }),
        createField("attendeePhoneNumber"),
        createField("email", { type: "email" }),
        createField("smsReminderNumber"),
      ];

      const { result } = renderHook(() => useBookerPhoneFields(fields));

      expect(result.current.consolidatedPhoneInfo).not.toBeNull();
      expect(result.current.displayFields).toHaveLength(3); // name, consolidated phone, email
      expect(result.current.displayFields[1].name).toBe("attendeePhoneNumber"); // canonical field
    });

    it("should not consolidate when only one system phone field exists", () => {
      const fields = [
        createField("name", { type: "text" }),
        createField("attendeePhoneNumber"),
        createField("email", { type: "email" }),
      ];

      const { result } = renderHook(() => useBookerPhoneFields(fields));

      expect(result.current.consolidatedPhoneInfo).toBeNull();
      expect(result.current.displayFields).toHaveLength(3);
      expect(result.current.isConsolidatedPhoneField("attendeePhoneNumber")).toBe(false);
    });

    it("should not consolidate when no system phone fields exist", () => {
      const fields = [
        createField("name", { type: "text" }),
        createField("customPhone", { type: "phone" }), // not a system phone field
        createField("email", { type: "email" }),
      ];

      const { result } = renderHook(() => useBookerPhoneFields(fields));

      expect(result.current.consolidatedPhoneInfo).toBeNull();
      expect(result.current.displayFields).toHaveLength(3);
    });

    it("should use attendeePhoneNumber as canonical field when present", () => {
      const fields = [
        createField("smsReminderNumber"),
        createField("attendeePhoneNumber"),
        createField("aiAgentCallPhoneNumber"),
      ];

      const { result } = renderHook(() => useBookerPhoneFields(fields));

      expect(result.current.displayFields[0].name).toBe("attendeePhoneNumber");
      expect(result.current.isConsolidatedPhoneField("attendeePhoneNumber")).toBe(true);
      expect(result.current.isConsolidatedPhoneField("smsReminderNumber")).toBe(false);
    });

    it("should set isRequired to true if any phone field is required", () => {
      const fields = [
        createField("attendeePhoneNumber", { required: false }),
        createField("smsReminderNumber", { required: true }),
      ];

      const { result } = renderHook(() => useBookerPhoneFields(fields));

      expect(result.current.consolidatedPhoneInfo?.isRequired).toBe(true);
      expect(result.current.displayFields[0].required).toBe(true);
    });

    it("should set isHidden to true only if all phone fields are hidden", () => {
      const fields = [
        createField("attendeePhoneNumber", { hidden: true }),
        createField("smsReminderNumber", { hidden: false }),
      ];

      const { result } = renderHook(() => useBookerPhoneFields(fields));

      expect(result.current.consolidatedPhoneInfo?.isHidden).toBe(false);
      expect(result.current.displayFields[0].hidden).toBe(false);
    });

    it("should set isHidden to true when all phone fields are hidden", () => {
      const fields = [
        createField("attendeePhoneNumber", { hidden: true }),
        createField("smsReminderNumber", { hidden: true }),
      ];

      const { result } = renderHook(() => useBookerPhoneFields(fields));

      expect(result.current.consolidatedPhoneInfo?.isHidden).toBe(true);
      expect(result.current.displayFields[0].hidden).toBe(true);
    });

    it("should detect hasSmsWorkflow when smsReminderNumber is present", () => {
      const fields = [createField("attendeePhoneNumber"), createField("smsReminderNumber")];

      const { result } = renderHook(() => useBookerPhoneFields(fields));

      expect(result.current.consolidatedPhoneInfo?.hasSmsWorkflow).toBe(true);
      expect(result.current.consolidatedPhoneInfo?.hasCalAiWorkflow).toBe(false);
    });

    it("should detect hasCalAiWorkflow when aiAgentCallPhoneNumber is present", () => {
      const fields = [createField("attendeePhoneNumber"), createField("aiAgentCallPhoneNumber")];

      const { result } = renderHook(() => useBookerPhoneFields(fields));

      expect(result.current.consolidatedPhoneInfo?.hasSmsWorkflow).toBe(false);
      expect(result.current.consolidatedPhoneInfo?.hasCalAiWorkflow).toBe(true);
    });

    it("should detect both workflows when both phone fields are present", () => {
      const fields = [
        createField("attendeePhoneNumber"),
        createField("smsReminderNumber"),
        createField("aiAgentCallPhoneNumber"),
      ];

      const { result } = renderHook(() => useBookerPhoneFields(fields));

      expect(result.current.consolidatedPhoneInfo?.hasSmsWorkflow).toBe(true);
      expect(result.current.consolidatedPhoneInfo?.hasCalAiWorkflow).toBe(true);
    });

    it("should include all field names in consolidatedPhoneInfo", () => {
      const fields = [
        createField("attendeePhoneNumber"),
        createField("smsReminderNumber"),
        createField("aiAgentCallPhoneNumber"),
      ];

      const { result } = renderHook(() => useBookerPhoneFields(fields));

      expect(result.current.consolidatedPhoneInfo?.fieldNames).toEqual([
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

      const { result } = renderHook(() => useBookerPhoneFields(fields, { enabled: false }));

      expect(result.current.consolidatedPhoneInfo).toBeNull();
      expect(result.current.displayFields).toHaveLength(3);
      expect(result.current.displayFields).toEqual(fields);
      expect(result.current.isConsolidatedPhoneField("attendeePhoneNumber")).toBe(false);
    });

    it("should not consolidate even with multiple system phone fields", () => {
      const fields = [
        createField("name", { type: "text" }),
        createField("attendeePhoneNumber"),
        createField("smsReminderNumber"),
      ];

      const { result } = renderHook(() => useBookerPhoneFields(fields, { enabled: false }));

      expect(result.current.consolidatedPhoneInfo).toBeNull();
      expect(result.current.displayFields).toHaveLength(3);
      expect(result.current.displayFields[1].name).toBe("attendeePhoneNumber");
      expect(result.current.displayFields[2].name).toBe("smsReminderNumber");
    });
  });
});

describe("createPhoneSyncHandler", () => {
  it("should sync phone value to all specified fields", () => {
    const setValue = vi.fn();
    const fieldNames = ["attendeePhoneNumber", "smsReminderNumber", "aiAgentCallPhoneNumber"];

    const syncHandler = createPhoneSyncHandler(fieldNames, setValue);
    syncHandler("+1234567890");

    expect(setValue).toHaveBeenCalledTimes(3);
    expect(setValue).toHaveBeenCalledWith("responses.attendeePhoneNumber", "+1234567890", {
      shouldDirty: true,
      shouldValidate: false,
    });
    expect(setValue).toHaveBeenCalledWith("responses.smsReminderNumber", "+1234567890", {
      shouldDirty: true,
      shouldValidate: false,
    });
    expect(setValue).toHaveBeenCalledWith("responses.aiAgentCallPhoneNumber", "+1234567890", {
      shouldDirty: true,
      shouldValidate: false,
    });
  });
});
