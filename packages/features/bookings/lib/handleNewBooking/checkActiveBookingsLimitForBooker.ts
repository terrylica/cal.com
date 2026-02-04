import type { BookingRepository } from "@calcom/features/bookings/repositories/BookingRepository";
import { ErrorCode } from "@calcom/lib/errorCodes";
import { ErrorWithCode } from "@calcom/lib/errors";
import logger from "@calcom/lib/logger";
import prisma from "@calcom/prisma";
import { BookingStatus } from "@calcom/prisma/enums";

const log = logger.getSubLogger({ prefix: ["[checkActiveBookingsLimitForBooker]"] });

export const checkActiveBookingsLimitForBooker = async ({
  eventTypeId,
  maxActiveBookingsPerBooker,
  bookerEmail,
  offerToRescheduleLastBooking,
  bookingRepository,
}: {
  eventTypeId: number;
  maxActiveBookingsPerBooker: number | null;
  bookerEmail: string;
  offerToRescheduleLastBooking: boolean;
  bookingRepository?: BookingRepository;
}) => {
  if (!maxActiveBookingsPerBooker) {
    return;
  }

  if (offerToRescheduleLastBooking) {
    await checkActiveBookingsLimitAndOfferReschedule({
      eventTypeId,
      maxActiveBookingsPerBooker,
      bookerEmail,
      bookingRepository,
    });
  } else {
    await checkActiveBookingsLimit({ eventTypeId, maxActiveBookingsPerBooker, bookerEmail, bookingRepository });
  }
};

const checkActiveBookingsLimit = async ({
  eventTypeId,
  maxActiveBookingsPerBooker,
  bookerEmail,
  bookingRepository,
}: {
  eventTypeId: number;
  maxActiveBookingsPerBooker: number;
  bookerEmail: string;
  bookingRepository?: BookingRepository;
}) => {
  const bookingsCount = bookingRepository
    ? await bookingRepository.countActiveBookingsForEventType({ eventTypeId, bookerEmail })
    : await prisma.booking.count({
        where: {
          eventTypeId,
          startTime: {
            gte: new Date(),
          },
          status: {
            in: [BookingStatus.ACCEPTED],
          },
          attendees: {
            some: {
              email: bookerEmail,
            },
          },
        },
      });

  if (bookingsCount >= maxActiveBookingsPerBooker) {
    log.warn(`Maximum booking limit reached for ${bookerEmail} for event type ${eventTypeId}`);
    throw new ErrorWithCode(ErrorCode.BookerLimitExceeded, ErrorCode.BookerLimitExceeded, {
      count: maxActiveBookingsPerBooker,
    });
  }
};

const checkActiveBookingsLimitAndOfferReschedule = async ({
  eventTypeId,
  maxActiveBookingsPerBooker,
  bookerEmail,
  bookingRepository,
}: {
  eventTypeId: number;
  maxActiveBookingsPerBooker: number;
  bookerEmail: string;
  bookingRepository?: BookingRepository;
}) => {
  const bookings = bookingRepository
    ? await bookingRepository.findActiveBookingsForEventType({
        eventTypeId,
        bookerEmail,
        limit: maxActiveBookingsPerBooker,
      })
    : await prisma.booking.findMany({
        where: {
          eventTypeId,
          startTime: {
            gte: new Date(),
          },
          status: {
            in: [BookingStatus.ACCEPTED],
          },
          attendees: {
            some: {
              email: bookerEmail,
            },
          },
        },
        orderBy: {
          startTime: "desc",
        },
        take: maxActiveBookingsPerBooker,
        select: {
          uid: true,
          startTime: true,
          attendees: {
            select: {
              name: true,
              email: true,
              bookingSeat: {
                select: {
                  referenceUid: true,
                },
              },
            },
            where: {
              email: bookerEmail,
            },
          },
        },
      });

  const lastBooking = bookings[bookings.length - 1];
  const seatUid = lastBooking?.attendees[0]?.bookingSeat?.referenceUid;

  if (bookings.length >= maxActiveBookingsPerBooker) {
    log.warn(`Maximum booking limit reached for ${bookerEmail} for event type ${eventTypeId}`);
    throw new ErrorWithCode(
      ErrorCode.BookerLimitExceededReschedule,
      ErrorCode.BookerLimitExceededReschedule,
      {
        rescheduleUid: lastBooking.uid,
        startTime: lastBooking.startTime,
        attendees: lastBooking.attendees,
        seatUid,
      }
    );
  }
};
