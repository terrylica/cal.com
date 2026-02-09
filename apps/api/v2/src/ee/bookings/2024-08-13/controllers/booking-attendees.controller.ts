import { BOOKING_WRITE, SUCCESS_STATUS } from "@calcom/platform-constants";
import { Controller, Delete, HttpCode, HttpStatus, Param, ParseIntPipe, UseGuards } from "@nestjs/common";
import { ApiHeader, ApiOperation, ApiTags as DocsTags } from "@nestjs/swagger";
import { BookingUidGuard } from "@/ee/bookings/2024-08-13/guards/booking-uid.guard";
import { RemoveAttendeeOutput_2024_08_13 } from "@/ee/bookings/2024-08-13/outputs/remove-attendee.output";
import { BookingAttendeesService_2024_08_13 } from "@/ee/bookings/2024-08-13/services/booking-attendees.service";
import { VERSION_2024_08_13, VERSION_2024_08_13_VALUE } from "@/lib/api-versions";
import { API_KEY_OR_ACCESS_TOKEN_HEADER } from "@/lib/docs/headers";
import { Throttle } from "@/lib/endpoint-throttler-decorator";
import { GetUser } from "@/modules/auth/decorators/get-user/get-user.decorator";
import { Permissions } from "@/modules/auth/decorators/permissions/permissions.decorator";
import { ApiAuthGuard } from "@/modules/auth/guards/api-auth/api-auth.guard";
import { PermissionsGuard } from "@/modules/auth/guards/permissions/permissions.guard";
import { ApiAuthGuardUser } from "@/modules/auth/strategies/api-auth/api-auth.strategy";

@Controller({
  path: "/v2/bookings/:bookingUid/attendees",
  version: VERSION_2024_08_13_VALUE,
})
@UseGuards(PermissionsGuard)
@DocsTags("Bookings / Attendees")
@ApiHeader({
  name: "cal-api-version",
  description: `Must be set to ${VERSION_2024_08_13}. This header is required as this endpoint does not exist in older API versions.`,
  example: VERSION_2024_08_13,
  required: true,
})
export class BookingAttendeesController_2024_08_13 {
  constructor(private readonly bookingAttendeesService: BookingAttendeesService_2024_08_13) {}

  @Delete("/:attendeeId")
  @HttpCode(HttpStatus.OK)
  @Permissions([BOOKING_WRITE])
  @UseGuards(ApiAuthGuard, BookingUidGuard)
  @Throttle({
    limit: 5,
    ttl: 60000,
    blockDuration: 60000,
    name: "booking_attendees_add",
  })
  @ApiHeader(API_KEY_OR_ACCESS_TOKEN_HEADER)
  @ApiOperation({
    summary: "Remove an attendee from a booking",
    description: `Remove an attendee from an existing booking by their attendee ID. The primary attendee (first attendee) cannot be removed.

    <Note>The cal-api-version header is required for this endpoint. Without it, the request will fail with a 404 error.</Note>
    `,
  })
  async removeAttendee(
    @Param("bookingUid") bookingUid: string,
    @Param("attendeeId", ParseIntPipe) attendeeId: number,
    @GetUser() user: ApiAuthGuardUser
  ): Promise<RemoveAttendeeOutput_2024_08_13> {
    const removedAttendee = await this.bookingAttendeesService.removeAttendee(bookingUid, attendeeId, user);

    return {
      status: SUCCESS_STATUS,
      data: removedAttendee,
    };
  }
}
