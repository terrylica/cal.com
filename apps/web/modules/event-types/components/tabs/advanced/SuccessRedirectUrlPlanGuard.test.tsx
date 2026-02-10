import { TooltipProvider } from "@radix-ui/react-tooltip";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";

vi.mock("@formkit/auto-animate/react", () => ({
  useAutoAnimate: () => [null],
}));

vi.mock("next/navigation", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/navigation")>();
  return {
    ...actual,
    useRouter: vi.fn(() => ({
      push: vi.fn(),
    })),
  };
});

vi.mock("@calcom/atoms/hooks/useAtomsContext", () => ({
  useAtomsContext: () => ({ clientId: null }),
}));

vi.mock("@calcom/atoms/hooks/useIsPlatform", () => ({
  useIsPlatform: () => false,
}));

vi.mock("@calcom/features/ee/managed-event-types/hooks/useLockedFieldsManager", () => ({
  default: () => ({
    isChildrenManagedEventType: false,
    isManagedEventType: false,
    shouldLockDisableProps: () => ({ disabled: false, LockedIcon: false, isLocked: false }),
    shouldLockIndicator: () => ({ LockedIcon: false }),
  }),
}));

vi.mock("@calcom/features/bookings/lib/getLocationOptionsForSelect", () => ({
  default: () => [],
}));

vi.mock("@calcom/features/calendars/components/DestinationCalendarSelector", () => ({
  default: () => <div data-testid="mock-destination-calendar" />,
}));

vi.mock("@calcom/web/modules/timezone/components/TimezoneSelect", () => ({
  TimezoneSelect: () => <div data-testid="mock-timezone-select" />,
}));

vi.mock("@calcom/web/modules/calendars/components/SelectedCalendarsSettingsWebWrapper", () => ({
  SelectedCalendarsSettingsWebWrapper: () => <div />,
  SelectedCalendarSettingsScope: { User: "User", EventType: "EventType" },
  SelectedCalendarsSettingsWebWrapperSkeleton: () => <div />,
}));

vi.mock("@calcom/web/modules/settings/components/BookerLayoutSelector", () => ({
  BookerLayoutSelector: () => <div />,
}));

vi.mock("@calcom/web/modules/event-types/components/AddVerifiedEmail", () => ({
  default: () => <div />,
}));

vi.mock("@calcom/web/modules/event-types/components", () => ({
  MultiplePrivateLinksController: () => <div />,
}));

vi.mock("@calcom/features/eventtypes/components/LearnMoreLink", () => ({
  LearnMoreLink: ({ i18nKey }: { i18nKey: string }) => <span>{i18nKey}</span>,
}));

vi.mock("@calcom/app-store/_utils/payments/getPaymentAppData", () => ({
  getPaymentAppData: () => ({ price: 0, currency: "usd" }),
}));

vi.mock("@calcom/atoms/timezone", () => ({
  Timezone: () => <div />,
}));

vi.mock("./FormBuilder", () => ({
  FormBuilder: () => <div data-testid="mock-form-builder" />,
}));

vi.mock("./CustomEventTypeModal", () => ({
  default: () => <div />,
}));

vi.mock("./DisableAllEmailsSetting", () => ({
  DisableAllEmailsSetting: () => <div />,
}));

vi.mock("./DisableReschedulingController", () => ({
  default: () => <div />,
}));

vi.mock("./RequiresConfirmationController", () => ({
  default: () => <div />,
}));

import type { EventAdvancedTabProps } from "./EventAdvancedTab";
import { EventAdvancedTab } from "./EventAdvancedTab";

const createMinimalEventType = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  title: "Test Event",
  slug: "test-event",
  length: 30,
  schedulingType: null,
  workflows: [],
  disableRescheduling: false,
  allowReschedulingCancelledBookings: false,
  eventTypeColor: null,
  eventName: null,
  interfaceLanguage: null,
  ...overrides,
});

const defaultFormValues = {
  title: "Test Event",
  eventName: "",
  successRedirectUrl: "",
  redirectUrlOnNoRoutingFormResponse: "",
  forwardParamsSuccessRedirect: false,
  bookingFields: [],
  locations: [],
  users: [{ name: "Test User" }],
  length: 30,
  metadata: {},
  multiplePrivateLinks: [],
  requiresConfirmation: false,
  seatsPerTimeSlotEnabled: false,
  requiresBookerEmailVerification: false,
  hideCalendarNotes: false,
  hideCalendarEventDetails: false,
  lockTimeZoneToggleOnBookingPage: false,
  canSendCalVideoTranscriptionEmails: false,
  autoTranslateDescriptionEnabled: false,
  interfaceLanguage: null,
  destinationCalendar: null,
  useEventTypeDestinationCalendarEmail: false,
  secondaryEmailId: -1,
  useEventLevelSelectedCalendars: false,
  customReplyToEmail: null,
  disabledCancelling: false,
};

const Wrapper = ({
  children,
  formValues = defaultFormValues,
}: {
  children: ReactNode;
  formValues?: Record<string, unknown>;
}) => {
  const form = useForm({ defaultValues: formValues });
  return (
    <TooltipProvider>
      <FormProvider {...form}>{children}</FormProvider>
    </TooltipProvider>
  );
};

const renderTab = (
  propsOverrides: Partial<EventAdvancedTabProps> = {},
  formValues?: Record<string, unknown>
) => {
  const props: EventAdvancedTabProps = {
    eventType: createMinimalEventType() as EventAdvancedTabProps["eventType"],
    team: null,
    calendarsQuery: { data: undefined, isPending: false, error: null },
    showBookerLayoutSelector: false,
    showToast: vi.fn(),
    orgId: null,
    hasPaidPlan: true,
    ...propsOverrides,
  };

  return render(<EventAdvancedTab {...props} />, {
    wrapper: ({ children }: { children: ReactNode }) => <Wrapper formValues={formValues}>{children}</Wrapper>,
  });
};

describe("successRedirectUrl plan guard", () => {
  it("shows toggle enabled for paid users", () => {
    renderTab({ hasPaidPlan: true });

    const toggle = screen.getByTestId("redirect-success-booking");
    expect(toggle).toBeInTheDocument();
    expect(toggle).not.toBeDisabled();
  });

  it("shows toggle disabled with upgrade badge for free users without existing URL", () => {
    renderTab({ hasPaidPlan: false });

    const toggle = screen.getByTestId("redirect-success-booking");
    expect(toggle).toBeInTheDocument();
    expect(toggle).toBeDisabled();
    expect(screen.getByText("upgrade")).toBeInTheDocument();
  });

  it("shows existing redirect URL as read-only with grandfathered message for free users", () => {
    renderTab({ hasPaidPlan: false }, { ...defaultFormValues, successRedirectUrl: "https://example.com" });

    expect(screen.getByText("redirect_url_grandfathered")).toBeInTheDocument();

    const input = screen.getByTestId("external-redirect-url");
    expect(input).toBeDisabled();
  });

  it("does not show upgrade badge for paid users", () => {
    renderTab({ hasPaidPlan: true });

    expect(screen.queryByText("upgrade")).not.toBeInTheDocument();
  });

  it("shows normal editable form for paid users with existing URL", () => {
    renderTab({ hasPaidPlan: true }, { ...defaultFormValues, successRedirectUrl: "https://example.com" });

    expect(screen.queryByText("redirect_url_grandfathered")).not.toBeInTheDocument();
  });
});
