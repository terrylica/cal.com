import { trpc } from "@calcom/trpc/react";
import useMeQuery from "@calcom/trpc/react/hooks/useMeQuery";
import { useMemo } from "react";

import type { FilterCategory, FilterOption } from "../components/BookingsFilters";
import { useEventTypes } from "./useEventTypes";

interface UseBookingFilterCategoriesOptions {
  canReadOthersBookings: boolean;
}

export function useBookingFilterCategories({ canReadOthersBookings }: UseBookingFilterCategoriesOptions) {
  const eventTypes = useEventTypes();
  const { data: teams } = trpc.viewer.teams.list.useQuery();
  const { data: members } = trpc.viewer.teams.listSimpleMembers.useQuery(undefined, {
    enabled: canReadOthersBookings,
  });
  const { data: currentUser } = useMeQuery();

  const filterCategories = useMemo<FilterCategory[]>(() => {
    const categories: FilterCategory[] = [];

    const eventTypeOptions: FilterOption[] = (eventTypes || []).map((et) => ({
      id: String(et.value),
      label: et.label,
    }));
    if (eventTypeOptions.length > 0) {
      categories.push({
        id: "eventTypeId",
        label: "Event Type",
        options: eventTypeOptions,
      });
    }

    let memberOptions: FilterOption[] = [];
    if (canReadOthersBookings) {
      memberOptions = (members || [])
        .filter((member) => member.name)
        .map((member) => ({
          id: String(member.id),
          label: member.name || "",
          avatar: member.avatarUrl,
        }));
    } else if (currentUser) {
      memberOptions = [
        {
          id: String(currentUser.id),
          label: currentUser.name || currentUser.email,
          avatar: currentUser.avatarUrl,
        },
      ];
    }
    if (memberOptions.length > 0) {
      categories.push({
        id: "userIds",
        label: "Member",
        options: memberOptions,
      });
    }

    categories.push({
      id: "attendeesName",
      label: "Attendees Name",
      options: [],
    });

    categories.push({
      id: "attendeeEmail",
      label: "Attendee Email",
      options: [],
    });

    categories.push({
      id: "dateRange",
      label: "Date Range",
      options: [
        { id: "today", label: "Today" },
        { id: "yesterday", label: "Yesterday" },
        { id: "this-week", label: "This Week" },
        { id: "last-week", label: "Last Week" },
        { id: "this-month", label: "This Month" },
        { id: "last-month", label: "Last Month" },
        { id: "custom", label: "Custom Range" },
      ],
    });

    categories.push({
      id: "bookingUid",
      label: "Booking UID",
      options: [],
    });

    const teamOptions: FilterOption[] = (teams || []).map((team) => ({
      id: String(team.id),
      label: team.name,
    }));
    if (teamOptions.length > 0) {
      categories.push({
        id: "teamId",
        label: "Team",
        options: teamOptions,
      });
    }

    return categories;
  }, [eventTypes, teams, members, canReadOthersBookings, currentUser]);

  return filterCategories;
}
