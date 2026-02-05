import { BookingsRepository_2024_08_13 } from "@/ee/bookings/2024-08-13/repositories/bookings.repository";
import { ApiAuthGuardUser } from "@/modules/auth/strategies/api-auth/api-auth.strategy";
import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { plainToClass } from "class-transformer";

import { BookingAttendeeOutput_2024_08_13 } from "@calcom/platform-types";

@Injectable()
export class BookingAttendeesService_2024_08_13 {
  private readonly logger = new Logger("BookingAttendeesService_2024_08_13");

  constructor(private readonly bookingsRepository: BookingsRepository_2024_08_13) {}

  private getDisplayEmail(email: string): string {
    return email.replace(/\+[a-zA-Z0-9]{25}/, "");
  }

  async getBookingAttendees(
    bookingUid: string,
    user: ApiAuthGuardUser
  ): Promise<BookingAttendeeOutput_2024_08_13[]> {
    const booking = await this.bookingsRepository.getByUidWithAttendeesAndUserAndEvent(bookingUid);
    if (!booking) {
      throw new NotFoundException(`Booking with uid ${bookingUid} not found`);
    }

    return booking.attendees.map((attendee) =>
      plainToClass(
        BookingAttendeeOutput_2024_08_13,
        {
          name: attendee.name,
          email: attendee.email,
          displayEmail: this.getDisplayEmail(attendee.email),
          timeZone: attendee.timeZone,
          language: attendee.locale ?? undefined,
          absent: attendee.noShow ?? false,
          phoneNumber: attendee.phoneNumber ?? undefined,
        },
        { strategy: "excludeAll" }
      )
    );
  }
}
