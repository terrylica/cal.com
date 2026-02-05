import { BookingPbacGuard } from "@/ee/bookings/2024-08-13/guards/booking-pbac.guard";
import { BookingUidGuard } from "@/ee/bookings/2024-08-13/guards/booking-uid.guard";
import { GetBookingAttendeesOutput_2024_08_13 } from "@/ee/bookings/2024-08-13/outputs/get-booking-attendees.output";
import { BookingAttendeesService_2024_08_13 } from "@/ee/bookings/2024-08-13/services/booking-attendees.service";
import {
  VERSION_2024_08_13_VALUE,
  VERSION_2024_08_13,
} from "@/lib/api-versions";
import { API_KEY_OR_ACCESS_TOKEN_HEADER } from "@/lib/docs/headers";
import { Throttle } from "@/lib/endpoint-throttler-decorator";
import { Permissions } from "@/modules/auth/decorators/permissions/permissions.decorator";
import { ApiAuthGuard } from "@/modules/auth/guards/api-auth/api-auth.guard";
import { PermissionsGuard } from "@/modules/auth/guards/permissions/permissions.guard";
import { Controller, Get, UseGuards, Param } from "@nestjs/common";
import { ApiOperation, ApiTags as DocsTags, ApiHeader } from "@nestjs/swagger";

import { BOOKING_READ, SUCCESS_STATUS } from "@calcom/platform-constants";

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
  constructor(
    private readonly bookingAttendeesService: BookingAttendeesService_2024_08_13
  ) {}

  @Get("/")
  @Permissions([BOOKING_READ])
  @UseGuards(ApiAuthGuard, BookingUidGuard, BookingPbacGuard)
  @Throttle({
    limit: 5,
    ttl: 60000,
    blockDuration: 60000,
    name: "booking_attendees_get",
  })
  @ApiHeader(API_KEY_OR_ACCESS_TOKEN_HEADER)
  @ApiOperation({
    summary: "Get all attendees for a booking",
    description: `Retrieve all attendees for a specific booking by its UID.
    
      **Rate Limiting:**
      This endpoint is rate limited to 5 requests per minute to prevent abuse.
    
      <Note>The cal-api-version header is required for this endpoint. Without it, the request will fail with a 404 error.</Note>
      `,
  })
  async getBookingAttendees(
    @Param("bookingUid") bookingUid: string
  ): Promise<GetBookingAttendeesOutput_2024_08_13> {
    const attendees = await this.bookingAttendeesService.getBookingAttendees(
      bookingUid
    );

    return {
      status: SUCCESS_STATUS,
      data: attendees,
    };
  }
}
