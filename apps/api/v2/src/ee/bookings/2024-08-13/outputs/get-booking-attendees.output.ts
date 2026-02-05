import { ApiProperty } from "@nestjs/swagger";
import { Expose, Type } from "class-transformer";
import { IsEnum, ValidateNested, IsArray, IsNumber, IsString, IsTimeZone } from "class-validator";

import { SUCCESS_STATUS, ERROR_STATUS } from "@calcom/platform-constants";

export class BookingAttendeeItem_2024_08_13 {
  @ApiProperty({ type: Number, example: 251 })
  @IsNumber()
  @Expose()
  id!: number;

  @ApiProperty({ type: Number, example: 313 })
  @IsNumber()
  @Expose()
  bookingId!: number;

  @ApiProperty({ type: String, example: "John Doe" })
  @IsString()
  @Expose()
  name!: string;

  @ApiProperty({ type: String, example: "john.doe@example.com" })
  @IsString()
  @Expose()
  email!: string;

  @ApiProperty({ type: String, example: "Asia/Jerusalem" })
  @IsTimeZone()
  @Expose()
  timeZone!: string;
}

export class GetBookingAttendeesOutput_2024_08_13 {
  @ApiProperty({ example: SUCCESS_STATUS, enum: [SUCCESS_STATUS, ERROR_STATUS] })
  @IsEnum([SUCCESS_STATUS, ERROR_STATUS])
  status!: typeof SUCCESS_STATUS | typeof ERROR_STATUS;

  @ApiProperty({ type: [BookingAttendeeItem_2024_08_13] })
  @ValidateNested({ each: true })
  @IsArray()
  @Type(() => BookingAttendeeItem_2024_08_13)
  data!: BookingAttendeeItem_2024_08_13[];
}
