import { useMemo } from "react";
import type { UseFormSetValue } from "react-hook-form";
import {
  ATTENDEE_PHONE_NUMBER_FIELD,
  CAL_AI_AGENT_PHONE_NUMBER_FIELD,
  SMS_REMINDER_NUMBER_FIELD,
  SYSTEM_PHONE_FIELDS,
} from "./SystemField";

type BookerField = {
  name: string;
  type: string;
  required?: boolean;
  hidden?: boolean;
  label?: string;
  [key: string]: unknown;
};

export type ConsolidatedPhoneInfo = {
  fieldNames: string[];
  isRequired: boolean;
  isHidden: boolean;
  hasSmsWorkflow: boolean;
  hasCalAiWorkflow: boolean;
};

export function useBookerPhoneFields<T extends BookerField>(fields: T[], options?: { enabled?: boolean }) {
  const enabled = options?.enabled ?? true;

  return useMemo(() => {
    // If consolidation is disabled, return original fields
    if (!enabled) {
      return {
        displayFields: fields,
        consolidatedPhoneInfo: null,
        isConsolidatedPhoneField: () => false,
      };
    }

    const systemPhoneFields = fields.filter((f) => SYSTEM_PHONE_FIELDS.has(f.name));

    if (systemPhoneFields.length <= 1) {
      return {
        displayFields: fields,
        consolidatedPhoneInfo: null,
        isConsolidatedPhoneField: () => false,
      };
    }

    const systemPhoneFieldNames = new Set(systemPhoneFields.map((f) => f.name));

    const canonicalField =
      systemPhoneFields.find((f) => f.name === ATTENDEE_PHONE_NUMBER_FIELD) || systemPhoneFields[0];

    const consolidatedPhoneInfo: ConsolidatedPhoneInfo = {
      fieldNames: systemPhoneFields.map((f) => f.name),
      isRequired: systemPhoneFields.some((f) => f.required),
      isHidden: systemPhoneFields.every((f) => f.hidden),
      hasSmsWorkflow: systemPhoneFields.some((f) => f.name === SMS_REMINDER_NUMBER_FIELD),
      hasCalAiWorkflow: systemPhoneFields.some((f) => f.name === CAL_AI_AGENT_PHONE_NUMBER_FIELD),
    };

    const displayFields: T[] = [];
    let consolidatedInserted = false;

    for (const field of fields) {
      if (systemPhoneFieldNames.has(field.name)) {
        if (!consolidatedInserted) {
          const consolidatedField = {
            ...canonicalField,
            required: consolidatedPhoneInfo.isRequired,
            hidden: consolidatedPhoneInfo.isHidden,
          };
          displayFields.push(consolidatedField);
          consolidatedInserted = true;
        }
      } else {
        displayFields.push(field);
      }
    }

    return {
      displayFields,
      consolidatedPhoneInfo,
      isConsolidatedPhoneField: (fieldName: string) => fieldName === canonicalField.name,
    };
  }, [fields, enabled]);
}

export function createPhoneSyncHandler(
  fieldNames: string[],
  setValue: UseFormSetValue<{ responses: Record<string, unknown> }>
) {
  return (phoneValue: string) => {
    fieldNames.forEach((fieldName) => {
      setValue(`responses.${fieldName}`, phoneValue, {
        shouldDirty: true,
        shouldValidate: false,
      });
    });
  };
}
