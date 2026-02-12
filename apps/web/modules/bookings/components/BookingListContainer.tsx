"use client";
import dayjs from "@calcom/dayjs";
import { useDataTable, useDisplayedFilterCount } from "@calcom/features/data-table";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { trpc } from "@calcom/trpc/react";
import useMeQuery from "@calcom/trpc/react/hooks/useMeQuery";
import { Alert } from "@calcom/ui/components/alert";
import { Badge } from "@calcom/ui/components/badge";
import { Button } from "@calcom/ui/components/button";
import { ToggleGroup } from "@calcom/ui/components/form";
import { WipeMyCalActionButton } from "@calcom/web/components/apps/wipemycalother/wipeMyCalActionButton";
import { getCoreRowModel, getSortedRowModel, useReactTable } from "@tanstack/react-table";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useBookingFilters } from "~/bookings/hooks/useBookingFilters";
import { useBookingListColumns } from "~/bookings/hooks/useBookingListColumns";
import { useBookingListData } from "~/bookings/hooks/useBookingListData";
import { useBookingStatusTab } from "~/bookings/hooks/useBookingStatusTab";
import { useFacetedUniqueValues } from "~/bookings/hooks/useFacetedUniqueValues";
import { useListAutoSelector } from "~/bookings/hooks/useListAutoSelector";
import { DataTableFilters, DataTableSegment } from "~/data-table/components";
import {
  BookingDetailsSheetStoreProvider,
  useBookingDetailsSheetStore,
} from "../store/bookingDetailsSheetStore";
import type { BookingListingStatus, BookingOutput, BookingsGetOutput, RowData } from "../types";
import { BookingDetailsSheet } from "./BookingDetailsSheet";
import { BookingList } from "./BookingList";
import { ViewToggleButton } from "./ViewToggleButton";

interface FilterButtonProps {
  table: ReturnType<typeof useReactTable<RowData>>;
  displayedFilterCount: number;
  setShowFilters: (value: boolean | ((prev: boolean) => boolean)) => void;
}

function FilterButton({ table, displayedFilterCount, setShowFilters }: FilterButtonProps) {
  const { t } = useLocale();

  if (displayedFilterCount === 0) {
    return <DataTableFilters.AddFilterButton table={table} />;
  }

  return (
    <Button
      color="secondary"
      StartIcon="list-filter"
      className="h-full"
      size="sm"
      onClick={() => setShowFilters((value) => !value)}>
      {t("filter")}
      <Badge variant="gray" className="ml-1">
        {displayedFilterCount}
      </Badge>
    </Button>
  );
}

interface BookingListContainerProps {
  status: BookingListingStatus;
  permissions: {
    canReadOthersBookings: boolean;
  };
  bookingsV3Enabled: boolean;
  bookingAuditEnabled: boolean;
  initialBookingUid?: string;
}

interface BookingListInnerProps extends BookingListContainerProps {
  data?: BookingsGetOutput;
  isPending: boolean;
  hasError: boolean;
  errorMessage?: string;
  totalRowCount?: number;
  bookings: BookingsGetOutput["bookings"];
  initialBookingUid?: string;
}

function getTabForBooking(booking: BookingOutput): "upcoming" | "recurring" | "past" | "cancelled" | "unconfirmed" {
  const now = new Date();
  const isPast = new Date(booking.endTime) <= now;

  if (booking.status === "CANCELLED" || booking.status === "REJECTED") {
    return "cancelled";
  }
  if (booking.status === "PENDING" && !isPast) {
    return "unconfirmed";
  }
  if (isPast) {
    return "past";
  }
  if (booking.recurringEventId) {
    return "recurring";
  }
  return "upcoming";
}

function BookingListInner({
  status,
  permissions,
  bookings,
  bookingsV3Enabled,
  bookingAuditEnabled,
  data,
  isPending,
  hasError,
  errorMessage,
  totalRowCount,
}: BookingListInnerProps) {
  const { t } = useLocale();
  const user = useMeQuery().data;
  const setSelectedBookingUid = useBookingDetailsSheetStore((state) => state.setSelectedBookingUid);
  const router = useRouter();
  const [showFilters, setShowFilters] = useState(true);

  // Handle auto-selection for list view
  useListAutoSelector(bookings);

  const ErrorView = errorMessage ? (
    <Alert severity="error" title={t("something_went_wrong")} message={errorMessage} />
  ) : undefined;

  const handleBookingClick = useCallback(
    (bookingUid: string) => {
      setSelectedBookingUid(bookingUid);
    },
    [setSelectedBookingUid]
  );

  const columns = useBookingListColumns({
    user,
    status,
    canReadOthersBookings: permissions.canReadOthersBookings,
    bookingsV3Enabled,
    handleBookingClick,
  });

  const finalData = useBookingListData({
    data,
    status,
    userTimeZone: user?.timeZone,
  });

  const getFacetedUniqueValues = useFacetedUniqueValues({
    canReadOthersBookings: permissions.canReadOthersBookings,
  });

  const displayedFilterCount = useDisplayedFilterCount();
  const { currentTab, tabOptions } = useBookingStatusTab();

  useEffect(() => {
    if (displayedFilterCount === 0) {
      // reset to true, so it shows filters as soon as any filter is applied
      setShowFilters(true);
    }
  }, [displayedFilterCount]);

  const table = useReactTable<RowData>({
    data: finalData,
    columns,
    initialState: {
      columnVisibility: {
        eventTypeId: false,
        teamId: false,
        userId: false,
        attendeeName: false,
        attendeeEmail: false,
        dateRange: false,
        bookingUid: false,
      },
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedUniqueValues,
  });

  const isEmpty = !data?.bookings || data.bookings.length === 0;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {/* Desktop: full width on first row, Mobile: full width on first row with horizontal scroll */}
        <div className="w-full md:w-auto">
          <div className="overflow-x-auto md:overflow-visible">
            <ToggleGroup
              value={currentTab}
              onValueChange={(value) => {
                if (!value) return;
                const selectedTab = tabOptions.find((tab) => tab.value === value);
                if (selectedTab?.href) {
                  router.push(selectedTab.href);
                }
              }}
              options={tabOptions}
            />
          </div>
        </div>

        {/* Desktop: second item on first row, Mobile: first item on second row */}
        <FilterButton
          table={table}
          displayedFilterCount={displayedFilterCount}
          setShowFilters={setShowFilters}
        />

        {/* Desktop: auto-pushed to right via flex-grow spacer, Mobile: continue on second row */}
        <div className="hidden grow md:block" />

        <DataTableSegment.Select />
        {/* <BookingsCsvDownload status={status} /> */}
        {bookingsV3Enabled && <ViewToggleButton bookingsV3Enabled={bookingsV3Enabled} />}
      </div>
      {displayedFilterCount > 0 && showFilters && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <DataTableFilters.ActiveFilters table={table} />
          <DataTableFilters.AddFilterButton table={table} variant="minimal" />

          {/* Desktop: auto-pushed to right via flex-grow spacer */}
          <div className="hidden flex-grow md:block" />

          <DataTableFilters.ClearFiltersButton />
          <DataTableSegment.SaveButton />
        </div>
      )}
      {status === "upcoming" && !isEmpty && (
        <WipeMyCalActionButton className="mt-4" bookingStatus={status} bookingsEmpty={isEmpty} />
      )}
      <div className="mt-4">
        <BookingList
          status={status}
          table={table}
          isPending={isPending}
          totalRowCount={totalRowCount}
          ErrorView={ErrorView}
          hasError={hasError}
        />
      </div>

      {bookingsV3Enabled && (
        <BookingDetailsSheet
          userTimeZone={user?.timeZone}
          userTimeFormat={user?.timeFormat === null ? undefined : user?.timeFormat}
          userId={user?.id}
          userEmail={user?.email}
          bookingAuditEnabled={bookingAuditEnabled}
        />
      )}
    </>
  );
}

export function BookingListContainer(props: BookingListContainerProps) {
  const { limit, offset, setPageIndex, isValidatorPending } = useDataTable();
  const { eventTypeIds, teamIds, userIds, dateRange, attendeeName, attendeeEmail, bookingUid } =
    useBookingFilters();

  const preSelectedBookingUid = props.initialBookingUid;
  const needsConfirmationOnSelectedBookingStatus = !!preSelectedBookingUid;
  const { data: fetchedBookingsData, isPending: isFetchingPreSelectedBookingData } =
    trpc.viewer.bookings.get.useQuery(
      {
        limit: 1,
        offset: 0,
        filters: {
          bookingUid: preSelectedBookingUid ?? undefined,
          statuses: ["upcoming", "recurring", "past", "cancelled", "unconfirmed"],
        },
      },
      {
        enabled: !!preSelectedBookingUid,
        staleTime: 5 * 60 * 1000,
      }
    );

  const preSelectedBooking = fetchedBookingsData?.bookings?.[0] ?? null;
  const pathname = usePathname();
  const router = useRouter();
  const [correctStatus, setCorrectStatus] = useState(props.status);
  const [isNavigatingToCorrectTab, startTransitionToCorrectTab] = useTransition();
  useEffect(() => {
    if (!preSelectedBooking) return;
    const correctTab = getTabForBooking(preSelectedBooking);
    const currentTab = pathname?.match(/\/bookings\/(\w+)/)?.[1];
    if (correctTab && currentTab && correctTab !== currentTab) {
      startTransitionToCorrectTab(() => {
        const newPath = pathname.replace(`/bookings/${currentTab}`, `/bookings/${correctTab}`);
        router.replace(`${newPath}${window.location.search}`);
      });
    }
    setCorrectStatus(correctTab);
  }, [preSelectedBooking, pathname, router]);

  const waitForConfirmationOnSelectedBookingStatus = needsConfirmationOnSelectedBookingStatus
    ? isFetchingPreSelectedBookingData
    : false;
  // Build query input once - shared between query and prefetching
  const queryInput = useMemo(
    () => ({
      limit,
      offset,
      filters: {
        statuses: [correctStatus],
        eventTypeIds,
        teamIds,
        userIds,
        attendeeName,
        attendeeEmail,
        bookingUid,
        afterStartDate: dateRange?.startDate
          ? dayjs(dateRange?.startDate).startOf("day").toISOString()
          : undefined,
        beforeEndDate: dateRange?.endDate ? dayjs(dateRange?.endDate).endOf("day").toISOString() : undefined,
      },
    }),
    [
      limit,
      offset,
      correctStatus,
      eventTypeIds,
      teamIds,
      userIds,
      attendeeName,
      attendeeEmail,
      bookingUid,
      dateRange,
    ]
  );
  const query = trpc.viewer.bookings.get.useQuery(queryInput, {
    staleTime: 5 * 60 * 1000, // 5 minutes - data is considered fresh
    gcTime: 30 * 60 * 1000, // 30 minutes - cache retention time
    // We need to wait for navigation to complete too otherwise we endup showing the bookings matching different status under different tab
    // This becomes necessary because switching tab runs RSC code which takes time and navigation doesn't complete without that
    enabled: !isValidatorPending && !waitForConfirmationOnSelectedBookingStatus && !isNavigatingToCorrectTab, // Wait for validator to be ready before fetching
  });

  const bookings = useMemo(() => query.data?.bookings ?? [], [query.data?.bookings]);

  // Always call the hook and provide navigation capabilities
  // The BookingDetailsSheet is only rendered when bookingsV3Enabled is true (see line 212)
  // const capabilities = useListNavigationCapabilities({
  //   limit,
  //   offset,
  //   totalCount: query.data?.totalCount,
  //   setPageIndex,
  //   queryInput,
  // });

  return (
    <BookingDetailsSheetStoreProvider bookings={bookings}>
      <BookingListInner
        {...props}
        status={correctStatus}
        data={query.data}
        isPending={query.isPending}
        hasError={!!query.error}
        errorMessage={query.error?.message}
        totalRowCount={query.data?.totalCount}
        bookings={bookings}
      />
    </BookingDetailsSheetStoreProvider>
  );
}
