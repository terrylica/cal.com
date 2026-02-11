import type { BookingStatus } from "@calcom/prisma/enums";
import type { BookingListingStatus } from "./validStatuses";

export function getBookingTabStatus(booking: {
  status: BookingStatus;
  endTime: Date;
  recurringEventId: string | null;
}): BookingListingStatus {
  const now = new Date();
  const isPast = booking.endTime <= now;

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
