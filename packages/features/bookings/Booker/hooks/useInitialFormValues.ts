import { useBookerStore } from "@calcom/features/bookings/Booker/store";
import type getBookingResponsesSchema from "@calcom/features/bookings/lib/getBookingResponsesSchema";
import { getBookingResponsesPartialSchema } from "@calcom/features/bookings/lib/getBookingResponsesSchema";
import type { BookerEvent } from "@calcom/features/bookings/types";
import { ATTENDEE_PHONE_NUMBER_FIELD, SYSTEM_PHONE_FIELDS } from "@calcom/lib/bookings/SystemField";
import { useEffect, useState } from "react";
import type { z } from "zod";

export type useInitialFormValuesReturnType = ReturnType<typeof useInitialFormValues>;

type UseInitialFormValuesProps = {
  eventType?: Pick<BookerEvent, "bookingFields" | "team" | "owner"> | null;
  rescheduleUid: string | null;
  isRescheduling: boolean;
  email?: string | null;
  name?: string | null;
  username?: string | null;
  hasSession: boolean;
  extraOptions: Record<string, string | string[]>;
  prefillFormParams: {
    guests: string[];
    name: string | null;
  };
  clientId?: string;
};

// Add this stable hash function
function getStableHash(obj: Record<string, string | string[]>) {
  return Object.entries(obj)
    .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
    .map(([key, value]) => {
      if (Array.isArray(value)) {
        return `${key}:${value.sort().join(",")}`;
      }
      return `${key}:${value}`;
    })
    .join("|");
}

const buildKey = ({
  values,
  hasSession,
  stableHashExtraOptions,
}: {
  values: Record<string, any>;
  hasSession: boolean;
  stableHashExtraOptions: string;
}) => {
  // We could think about removing specific items like values.length, hasSession and bookingId and instead use a stableHash maybe .
  return `${Object.keys(values).length}_${hasSession ? 1 : 0}_${
    values.bookingId ?? 0
  }_${stableHashExtraOptions}`;
};

/**
 * Consolidates system phone field values in responses.
 * If any system phone field has a value, copies it to all system phone fields.
 * This ensures prefill works correctly when user provides any phone field via URL.
 */
const consolidatePhoneFieldValues = (responses: Record<string, unknown>): Record<string, unknown> => {
  // Find the first non-empty system phone field value
  let phoneValue: string | undefined;
  for (const fieldName of SYSTEM_PHONE_FIELDS) {
    const value = responses[fieldName];
    if (typeof value === "string" && value.trim()) {
      phoneValue = value;
      break;
    }
  }

  // If no phone value found, return responses unchanged
  if (!phoneValue) {
    return responses;
  }

  // Copy the phone value to all system phone fields that exist in responses
  const consolidatedResponses = { ...responses };
  for (const fieldName of SYSTEM_PHONE_FIELDS) {
    // Only set if the field exists in responses (i.e., it's part of the event's booking fields)
    if (fieldName in responses) {
      consolidatedResponses[fieldName] = phoneValue;
    }
  }

  // Also ensure the canonical field has the value
  if (ATTENDEE_PHONE_NUMBER_FIELD in responses) {
    consolidatedResponses[ATTENDEE_PHONE_NUMBER_FIELD] = phoneValue;
  }

  return consolidatedResponses;
};

export function useInitialFormValues({
  eventType,
  rescheduleUid,
  isRescheduling,
  email,
  name,
  username,
  hasSession,
  extraOptions,
  prefillFormParams,
  clientId,
}: UseInitialFormValuesProps) {
  const stableHashExtraOptions = getStableHash(extraOptions);

  const [initialValuesState, setInitialValuesState] = useState<{
    values: {
      responses?: Partial<z.infer<ReturnType<typeof getBookingResponsesSchema>>>;
      bookingId?: number;
    };
    key: string;
  }>({
    values: {},
    key: "",
  });
  const bookingData = useBookerStore((state) => state.bookingData);
  const formValues = useBookerStore((state) => state.formValues);

  // Check if organization has disabled autofill from URL parameters
  const isAutofillDisabledByOrg =
    eventType?.team?.parent?.organizationSettings?.disableAutofillOnBookingPage ??
    eventType?.owner?.profile?.organization?.organizationSettings?.disableAutofillOnBookingPage ??
    false;
  useEffect(() => {
    (async () => {
      if (Object.keys(formValues).length) {
        setInitialValuesState({
          values: formValues,
          key: buildKey({ values: formValues, hasSession, stableHashExtraOptions }),
        });
        return;
      }

      if (!eventType?.bookingFields) {
        return {};
      }
      const querySchema = getBookingResponsesPartialSchema({
        bookingFields: eventType.bookingFields,
        view: rescheduleUid ? "reschedule" : "booking",
      });

      // If organization has disabled autofill, don't use URL parameters for prefill
      const urlParamsToUse = isAutofillDisabledByOrg
        ? {}
        : {
            ...extraOptions,
            name: prefillFormParams.name,
            // `guest` because we need to support legacy URL with `guest` query param support
            // `guests` because the `name` of the corresponding bookingField is `guests`
            guests: prefillFormParams.guests,
          };

      const parsedQuery = await querySchema.parseAsync(urlParamsToUse);

      const defaultUserValues = (() => {
        const rescheduledEmail =
          rescheduleUid && bookingData && bookingData.attendees.length > 0
            ? (bookingData.attendees[0].email ?? "")
            : "";
        const rescheduledName =
          rescheduleUid && bookingData && bookingData.attendees.length > 0
            ? (bookingData.attendees[0].name ?? "")
            : "";

        if (isAutofillDisabledByOrg) {
          return {
            email: rescheduledEmail,
            name: rescheduledName,
          };
        }

        return {
          email: rescheduledEmail || (parsedQuery["email"] ? parsedQuery["email"] : (email ?? "")),
          name: rescheduledName || (parsedQuery["name"] ? parsedQuery["name"] : (name ?? username ?? "")),
        };
      })();

      if (clientId) {
        defaultUserValues.email = defaultUserValues.email.replace(`+${clientId}`, "");
      }

      if (!isRescheduling) {
        const defaults = {
          responses: {} as Partial<z.infer<ReturnType<typeof getBookingResponsesSchema>>>,
        };

        const responses = eventType.bookingFields.reduce((responses, field) => {
          return {
            ...responses,
            [field.name]: parsedQuery[field.name] || undefined,
          };
        }, {});

        // Consolidate phone field values so prefill works for any system phone field
        const consolidatedResponses = consolidatePhoneFieldValues(responses);

        defaults.responses = {
          ...consolidatedResponses,
          name: defaultUserValues.name,
          email: defaultUserValues.email ?? "",
        };

        setInitialValuesState({
          values: defaults,
          key: buildKey({ values: defaults, hasSession, stableHashExtraOptions }),
        });
      }

      if (!rescheduleUid && !bookingData) {
        return {};
      }

      // We should allow current session user as default values for booking form

      const defaults = {
        responses: {} as Partial<z.infer<ReturnType<typeof getBookingResponsesSchema>>>,
        bookingId: bookingData?.id,
      };

      const responses = eventType.bookingFields.reduce((responses, field) => {
        return {
          ...responses,
          [field.name]: bookingData?.responses[field.name],
        };
      }, {});

      // Consolidate phone field values for rescheduling as well
      const consolidatedResponses = consolidatePhoneFieldValues(responses);

      defaults.responses = {
        ...consolidatedResponses,
        name: defaultUserValues.name,
        email: defaultUserValues.email ?? "",
      };
      setInitialValuesState({
        values: defaults,
        key: buildKey({ values: defaults, hasSession, stableHashExtraOptions }),
      });
    })();
    // TODO: Remove it. It was initially added so that we don't add extraOptions in deps but that is handled using stableHashExtraOptions now.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    eventType?.bookingFields,
    formValues,
    isRescheduling,
    bookingData,
    bookingData?.id,
    rescheduleUid,
    email,
    name,
    username,
    prefillFormParams,
    // We need to have extraOptions as a dep so that any change in query params can update the form values, but extraOptions itself isn't stable and changes reference on every render
    stableHashExtraOptions,
    isAutofillDisabledByOrg,
  ]);

  return initialValuesState;
}
