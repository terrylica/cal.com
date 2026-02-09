import { removeAttendeeHandler } from "@calcom/platform-libraries/bookings";
import { HttpException, Injectable, NotFoundException } from "@nestjs/common";
import { plainToClass } from "class-transformer";
import { RemovedAttendeeOutput_2024_08_13 } from "@/ee/bookings/2024-08-13/outputs/remove-attendee.output";
import { BookingsRepository_2024_08_13 } from "@/ee/bookings/2024-08-13/repositories/bookings.repository";
import { PlatformBookingsService } from "@/ee/bookings/shared/platform-bookings.service";
import { ApiAuthGuardUser } from "@/modules/auth/strategies/api-auth/api-auth.strategy";

@Injectable()
export class BookingAttendeesService_2024_08_13 {
  constructor(
    private readonly bookingsRepository: BookingsRepository_2024_08_13,
    private readonly platformBookingsService: PlatformBookingsService
  ) {}

  async removeAttendee(
    bookingUid: string,
    attendeeId: number,
    user: ApiAuthGuardUser
  ): Promise<RemovedAttendeeOutput_2024_08_13> {
    const booking = await this.bookingsRepository.getByUidWithAttendeesAndUserAndEvent(bookingUid);
    if (!booking) {
      throw new NotFoundException(`Booking with uid ${bookingUid} not found`);
    }

    const platformClientParams = booking.eventTypeId
      ? await this.platformBookingsService.getOAuthClientParams(booking.eventTypeId)
      : undefined;

    const emailsEnabled = platformClientParams ? platformClientParams.arePlatformEmailsEnabled : true;

    const res = await removeAttendeeHandler({
      ctx: { user },
      input: { bookingId: booking.id, attendeeId },
      emailsEnabled,
      actionSource: "API_V2",
    });

    if (res.message === "Attendee removed") {
      return plainToClass(
        RemovedAttendeeOutput_2024_08_13,
        {
          id: res.attendee.id,
          bookingId: res.attendee.bookingId,
          name: res.attendee.name,
          email: res.attendee.email,
          timeZone: res.attendee.timeZone,
        },
        { excludeExtraneousValues: true }
      );
    } else {
      throw new HttpException("Failed to remove attendee from the booking", 500);
    }
  }
}
