import type { fieldSchema } from "@calcom/prisma/zod-utils";
import type { z } from "zod";
import {
  ATTENDEE_PHONE_NUMBER_FIELD,
  CAL_AI_AGENT_PHONE_NUMBER_FIELD,
  SMS_REMINDER_NUMBER_FIELD,
  SYSTEM_PHONE_FIELDS,
} from "./SystemField";

type Field = z.infer<typeof fieldSchema>;
type Source = NonNullable<Field["sources"]>[number];

export const CANONICAL_PHONE_FIELD = ATTENDEE_PHONE_NUMBER_FIELD;

export const isSystemPhoneField = (fieldName: string): boolean => SYSTEM_PHONE_FIELDS.has(fieldName);

export const consolidatePhoneFieldSources = (fields: Field[]): Source[] => {
  const sourceMap = new Map<string, Source>();
  fields.forEach((f) => {
    (f.sources || []).forEach((s) => {
      if (!sourceMap.has(s.id)) {
        sourceMap.set(s.id, s);
      }
    });
  });
  return Array.from(sourceMap.values());
};

export const isAnyPhoneSourceRequired = (fields: Field[]): boolean => {
  if (fields.some((f) => f.required)) {
    return true;
  }

  return fields.flatMap((f) => f.sources || []).some((s) => s.fieldRequired);
};

export const getPhoneFieldBadgeInfo = (
  fields: Field[],
  isHidden?: boolean
): {
  hasPhoneLocation: boolean;
  hasSmsWorkflow: boolean;
  hasCalAiWorkflow: boolean;
} => {
  let hasPhoneLocation = false;
  let hasSmsWorkflow = false;
  let hasCalAiWorkflow = false;

  for (const field of fields) {
    const hasWorkflowSource = field.sources?.some((s) => s.type === "workflow");
    const hasDefaultSource = field.sources?.some((s) => s.type === "default");

    if (field.name === ATTENDEE_PHONE_NUMBER_FIELD && hasDefaultSource && !isHidden) {
      hasPhoneLocation = true;
    }
    if (field.name === SMS_REMINDER_NUMBER_FIELD && hasWorkflowSource) {
      hasSmsWorkflow = true;
    }
    if (field.name === CAL_AI_AGENT_PHONE_NUMBER_FIELD && hasWorkflowSource) {
      hasCalAiWorkflow = true;
    }
  }

  return { hasPhoneLocation, hasSmsWorkflow, hasCalAiWorkflow };
};
