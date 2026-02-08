import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsString, IsTimeZone } from "class-validator";

export class AddAttendeeInput_2024_08_13 {
  @ApiProperty({
    type: String,
    description: "The email of the attendee.",
    example: "john.doe@example.com",
  })
  @IsEmail()
  email!: string;

  @ApiProperty({
    type: String,
    description: "The name of the attendee.",
    example: "John Doe",
  })
  @IsString()
  name!: string;

  @ApiProperty({
    type: String,
    description: "The time zone of the attendee.",
    example: "Asia/Jerusalem",
  })
  @IsTimeZone()
  timeZone!: string;
}
