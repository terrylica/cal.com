import { trpc } from "@calcom/trpc/react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import type { BookingListingStatus } from "../types";

interface BookingForTabResolution {
  status: string;
  endTime: Date | string;
  recurringEventId: string | null;
}

export function getTabForBooking(booking: BookingForTabResolution): BookingListingStatus {
  const isPast = new Date(booking.endTime) <= new Date();

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

interface UsePreSelectedBookingOptions {
  initialBookingUid: string | undefined;
  defaultStatus: BookingListingStatus;
}

interface UsePreSelectedBookingResult {
  resolvedStatus: BookingListingStatus;
  isResolvingStatus: boolean;
}

export function usePreSelectedBooking({
  initialBookingUid,
  defaultStatus,
}: UsePreSelectedBookingOptions): UsePreSelectedBookingResult {
  const { data: fetchedData, isPending: isFetching } = trpc.viewer.bookings.get.useQuery(
    {
      limit: 1,
      offset: 0,
      filters: {
        bookingUid: initialBookingUid ?? undefined,
        statuses: ["upcoming", "recurring", "past", "cancelled", "unconfirmed"],
      },
    },
    {
      enabled: !!initialBookingUid,
      staleTime: 5 * 60 * 1000,
    }
  );

  const fetchedBooking = fetchedData?.bookings?.[0] ?? null;
  const pathname = usePathname();
  const router = useRouter();
  const [resolvedStatus, setResolvedStatus] = useState<BookingListingStatus>(defaultStatus);
  const [isNavigating, startNavigation] = useTransition();

  useEffect(() => {
    if (!fetchedBooking) return;
    const correctTab = getTabForBooking(fetchedBooking);
    const currentTab = pathname?.match(/\/bookings\/(\w+)/)?.[1];
    if (correctTab && currentTab && correctTab !== currentTab) {
      startNavigation(() => {
        const newPath = pathname.replace(`/bookings/${currentTab}`, `/bookings/${correctTab}`);
        router.replace(`${newPath}${window.location.search}`);
      });
    }
    setResolvedStatus(correctTab);
  }, [fetchedBooking, pathname, router]);

  const isResolvingStatus = initialBookingUid ? isFetching || isNavigating : false;

  return { resolvedStatus, isResolvingStatus };
}
