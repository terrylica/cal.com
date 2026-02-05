import { BookingAttendeeItem_2024_08_13 } from "@/ee/bookings/2024-08-13/outputs/get-booking-attendees.output";
import { BookingsRepository_2024_08_13 } from "@/ee/bookings/2024-08-13/repositories/bookings.repository";
import { ApiAuthGuardUser } from "@/modules/auth/strategies/api-auth/api-auth.strategy";
import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { plainToClass } from "class-transformer";

@Injectable()
export class BookingAttendeesService_2024_08_13 {
  private readonly logger = new Logger("BookingAttendeesService_2024_08_13");

  constructor(private readonly bookingsRepository: BookingsRepository_2024_08_13) {}

  async getBookingAttendees(
    bookingUid: string,
    user: ApiAuthGuardUser
  ): Promise<BookingAttendeeItem_2024_08_13[]> {
    const booking = await this.bookingsRepository.getByUidWithAttendeesAndUserAndEvent(bookingUid);
    if (!booking) {
      throw new NotFoundException(`Booking with uid ${bookingUid} not found`);
    }

    return booking.attendees.map((attendee) =>
      plainToClass(
        BookingAttendeeItem_2024_08_13,
        {
          id: attendee.id,
          bookingId: booking.id,
          name: attendee.name,
          email: attendee.email,
          timeZone: attendee.timeZone,
        },
        { strategy: "excludeAll" }
      )
    );
  }
}
