import "@calcom/lib/__mocks__/constants";

import React from "react";
import { vi, afterEach } from "vitest";

import { render, screen } from "@calcom/features/bookings/Booker/__tests__/test-utils";

vi.mock("@calcom/features/schedules/lib/use-schedule/useNonEmptyScheduleDays", () => ({
  useNonEmptyScheduleDays: () => [],
}));

vi.mock("@calcom/features/schedules/lib/use-schedule/useSlotsForDate", () => ({
  useSlotsForAvailableDates: () => ({ slotsPerDay: [], toggleConfirmButton: vi.fn() }),
}));

vi.mock("@calcom/features/bookings/Booker/utils/query-param", () => ({
  getQueryParam: () => null,
}));

vi.mock("@calcom/lib/webstorage", () => ({
  localStorage: {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));

vi.mock("@calcom/web/modules/bookings/components/AvailableTimes", () => ({
  AvailableTimes: () => <div data-testid="available-times" />,
  AvailableTimesSkeleton: () => <div data-testid="available-times-skeleton" />,
}));

vi.mock("@calcom/web/modules/bookings/components/AvailableTimesHeader", () => ({
  AvailableTimesHeader: () => <div data-testid="available-times-header" />,
}));

vi.mock("@calcom/ui/components/tooltip", () => ({
  Tooltip: ({ children, content }: { children: React.ReactNode; content: string }) => (
    <div data-testid="tooltip" data-content={content}>
      {children}
    </div>
  ),
}));

import { AvailableTimeSlots } from "./AvailableTimeSlots";

const defaultProps = {
  isLoading: false,
  event: { data: null },
  loadingStates: {} as Record<string, boolean>,
  isVerificationCodeSending: false,
  renderConfirmNotVerifyEmailButtonCond: false,
  onSubmit: vi.fn(),
  skipConfirmStep: false,
  unavailableTimeSlots: [] as string[],
  onAvailableTimeSlotSelect: vi.fn(),
};

describe("AvailableTimeSlots", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders CRM contact owner badge when teamMemberEmail is set", () => {
    render(<AvailableTimeSlots {...defaultProps} />, {
      mockStore: {
        teamMemberEmail: "owner@example.com",
        selectedDate: "2024-01-01",
      },
    });

    expect(screen.getByText("contact_owner")).toBeInTheDocument();
  });

  it("does not render CRM contact owner badge when teamMemberEmail is null", () => {
    render(<AvailableTimeSlots {...defaultProps} />, {
      mockStore: {
        teamMemberEmail: null,
        selectedDate: "2024-01-01",
      },
    });

    expect(screen.queryByText("contact_owner")).not.toBeInTheDocument();
  });

  it("shows teamMemberEmail in tooltip when badge is rendered", () => {
    render(<AvailableTimeSlots {...defaultProps} />, {
      mockStore: {
        teamMemberEmail: "crm-owner@company.com",
        selectedDate: "2024-01-01",
      },
    });

    expect(screen.getByText("contact_owner")).toBeInTheDocument();
    expect(screen.getByTestId("tooltip")).toHaveAttribute("data-content", "crm-owner@company.com");
  });
});
