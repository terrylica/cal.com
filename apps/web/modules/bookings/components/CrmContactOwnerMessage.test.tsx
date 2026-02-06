import "@calcom/lib/__mocks__/constants";

import React from "react";
import { vi, afterEach } from "vitest";

import { render, screen } from "@calcom/features/bookings/Booker/__tests__/test-utils";

import { CrmContactOwnerMessage } from "./CrmContactOwnerMessage";

describe("CrmContactOwnerMessage", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders banner with contact owner email when teamMemberEmail is set", () => {
    render(<CrmContactOwnerMessage />, {
      mockStore: {
        teamMemberEmail: "owner@example.com",
      },
    });

    expect(screen.getByTestId("crm-contact-owner-msg")).toBeInTheDocument();
    expect(screen.getByText("booking_with_contact_owner_name")).toBeInTheDocument();
  });

  it("does not render when teamMemberEmail is null", () => {
    render(<CrmContactOwnerMessage />, {
      mockStore: {
        teamMemberEmail: null,
      },
    });

    expect(screen.queryByTestId("crm-contact-owner-msg")).not.toBeInTheDocument();
  });

  it("renders with isEmbed prop adjusting top position", () => {
    const { container } = render(<CrmContactOwnerMessage isEmbed={true} />, {
      mockStore: {
        teamMemberEmail: "owner@example.com",
      },
    });

    const banner = container.querySelector(".top-0");
    expect(banner).toBeInTheDocument();
  });
});
