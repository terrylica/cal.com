import type { fieldsSchema } from "@calcom/features/form-builder/schema";
import { useMemo } from "react";
import type { z } from "zod";
import {
  CANONICAL_PHONE_FIELD,
  consolidatePhoneFieldSources,
  isAnyPhoneSourceRequired,
  isSystemPhoneField,
} from "./phoneFieldUtils";

type FormField = z.infer<typeof fieldsSchema>[number];

export type ConsolidatedFormField = FormField & {
  _consolidatedFrom?: string[];
};

export function useConsolidatedPhoneFields(fields: FormField[], options?: { enabled?: boolean }) {
  const enabled = options?.enabled ?? true;

  return useMemo(() => {
    // If consolidation is disabled, return original fields
    if (!enabled) {
      return {
        displayFields: fields as ConsolidatedFormField[],
        displayToOriginalIndex: fields.map((_, i) => i),
        phoneFieldIndices: null,
        isConsolidated: false,
        phoneFields: null,
      };
    }

    const phoneFieldsWithIndex = fields
      .map((f, index) => ({ field: f, index }))
      .filter(({ field }) => isSystemPhoneField(field.name));

    if (phoneFieldsWithIndex.length <= 1) {
      return {
        displayFields: fields as ConsolidatedFormField[],
        phoneFieldIndices: null,
        isConsolidated: false,
        phoneFields: null,
      };
    }

    const phoneFields = phoneFieldsWithIndex.map(({ field }) => field);
    const phoneFieldNames = new Set(phoneFields.map((f) => f.name));

    const canonical = phoneFields.find((f) => f.name === CANONICAL_PHONE_FIELD) || phoneFields[0];

    const consolidatedField: ConsolidatedFormField = {
      ...canonical,
      sources: consolidatePhoneFieldSources(phoneFields),
      required: isAnyPhoneSourceRequired(phoneFields),
      hidden: phoneFields.every((f) => f.hidden),
      // track which fields were consolidated for later sync
      _consolidatedFrom: phoneFields.map((f) => f.name),
    };

    const displayFields: ConsolidatedFormField[] = [];
    const displayToOriginalIndex: number[] = [];
    let consolidatedInserted = false;

    for (let i = 0; i < fields.length; i++) {
      const field = fields[i];
      if (phoneFieldNames.has(field.name)) {
        if (!consolidatedInserted) {
          displayFields.push(consolidatedField);
          displayToOriginalIndex.push(i);
          consolidatedInserted = true;
        }
      } else {
        displayFields.push(field);
        displayToOriginalIndex.push(i);
      }
    }

    return {
      displayFields,
      displayToOriginalIndex,
      phoneFieldIndices: new Map(phoneFieldsWithIndex.map(({ field, index }) => [field.name, index])),
      isConsolidated: true,
      phoneFields,
    };
  }, [fields, enabled]);
}
