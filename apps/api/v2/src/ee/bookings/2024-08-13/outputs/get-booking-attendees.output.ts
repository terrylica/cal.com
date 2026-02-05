import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsEnum, ValidateNested, IsArray } from "class-validator";

import { SUCCESS_STATUS, ERROR_STATUS } from "@calcom/platform-constants";
import { BookingAttendeeOutput_2024_08_13 } from "@calcom/platform-types";

export class GetBookingAttendeesOutput_2024_08_13 {
  @ApiProperty({ example: SUCCESS_STATUS, enum: [SUCCESS_STATUS, ERROR_STATUS] })
  @IsEnum([SUCCESS_STATUS, ERROR_STATUS])
  status!: typeof SUCCESS_STATUS | typeof ERROR_STATUS;

  @ApiProperty({ type: [BookingAttendeeOutput_2024_08_13] })
  @ValidateNested({ each: true })
  @IsArray()
  @Type(() => BookingAttendeeOutput_2024_08_13)
  data!: BookingAttendeeOutput_2024_08_13[];
}
