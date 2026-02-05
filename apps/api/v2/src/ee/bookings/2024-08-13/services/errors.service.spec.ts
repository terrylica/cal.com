import { BadRequestException, NotFoundException } from "@nestjs/common";
import { ZodError, ZodIssue, ZodIssueCode } from "zod";

import { ErrorsBookingsService_2024_08_13 } from "./errors.service";

describe("ErrorsBookingsService_2024_08_13", () => {
  let service: ErrorsBookingsService_2024_08_13;

  beforeEach(() => {
    service = new ErrorsBookingsService_2024_08_13();
  });

  describe("handleEventTypeToBeBookedNotFound", () => {
    it("should throw NotFoundException for user event type without org", () => {
      const body = {
        username: "testuser",
        eventTypeSlug: "test-event",
      };

      expect(() => service.handleEventTypeToBeBookedNotFound(body as any)).toThrow(NotFoundException);
      expect(() => service.handleEventTypeToBeBookedNotFound(body as any)).toThrow(
        "Event type with slug test-event belonging to user testuser not found."
      );
    });

    it("should throw NotFoundException for user event type with org", () => {
      const body = {
        username: "testuser",
        eventTypeSlug: "test-event",
        organizationSlug: "test-org",
      };

      expect(() => service.handleEventTypeToBeBookedNotFound(body as any)).toThrow(NotFoundException);
      expect(() => service.handleEventTypeToBeBookedNotFound(body as any)).toThrow(
        "Event type with slug test-event belonging to user testuser within organization test-org not found."
      );
    });

    it("should throw NotFoundException for team event type without org", () => {
      const body = {
        teamSlug: "test-team",
        eventTypeSlug: "test-event",
      };

      expect(() => service.handleEventTypeToBeBookedNotFound(body as any)).toThrow(NotFoundException);
      expect(() => service.handleEventTypeToBeBookedNotFound(body as any)).toThrow(
        "Event type with slug test-event belonging to team test-team not found."
      );
    });

    it("should throw NotFoundException for team event type with org", () => {
      const body = {
        teamSlug: "test-team",
        eventTypeSlug: "test-event",
        organizationSlug: "test-org",
      };

      expect(() => service.handleEventTypeToBeBookedNotFound(body as any)).toThrow(NotFoundException);
      expect(() => service.handleEventTypeToBeBookedNotFound(body as any)).toThrow(
        "Event type with slug test-event belonging to team test-team within organization test-org not found."
      );
    });

    it("should throw NotFoundException for event type by id", () => {
      const body = {
        eventTypeId: 123,
      };

      expect(() => service.handleEventTypeToBeBookedNotFound(body as any)).toThrow(NotFoundException);
      expect(() => service.handleEventTypeToBeBookedNotFound(body as any)).toThrow(
        "Event type with id 123 not found."
      );
    });
  });

  describe("handleBookingError", () => {
    it("should throw BadRequestException for no_available_users_found_error with team event", () => {
      const error = new Error("no_available_users_found_error");

      expect(() => service.handleBookingError(error, true)).toThrow(BadRequestException);
      expect(() => service.handleBookingError(error, true)).toThrow(
        "One of the hosts either already has booking at this time or is not available"
      );
    });

    it("should throw BadRequestException for no_available_users_found_error with non-team event", () => {
      const error = new Error("no_available_users_found_error");

      expect(() => service.handleBookingError(error, false)).toThrow(BadRequestException);
      expect(() => service.handleBookingError(error, false)).toThrow(
        "User either already has booking at this time or is not available"
      );
    });

    it("should throw BadRequestException for booking_time_out_of_bounds_error", () => {
      const error = new Error("booking_time_out_of_bounds_error");

      expect(() => service.handleBookingError(error, false)).toThrow(BadRequestException);
    });

    it("should throw BadRequestException for past meeting booking", () => {
      const error = new Error("Attempting to book a meeting in the past.");

      expect(() => service.handleBookingError(error, false)).toThrow(BadRequestException);
      expect(() => service.handleBookingError(error, false)).toThrow(
        "Attempting to book a meeting in the past."
      );
    });

    it("should throw BadRequestException for hosts_unavailable_for_booking", () => {
      const error = new Error("hosts_unavailable_for_booking");

      expect(() => service.handleBookingError(error, false)).toThrow(BadRequestException);
      expect(() => service.handleBookingError(error, false)).toThrow(
        "One of the hosts either already has booking at this time or is not available"
      );
    });

    it("should throw BadRequestException for booker_limit_exceeded_error", () => {
      const error = new Error("booker_limit_exceeded_error");

      expect(() => service.handleBookingError(error, false)).toThrow(BadRequestException);
      expect(() => service.handleBookingError(error, false)).toThrow(
        "Attendee with this email can't book because the maximum number of active bookings has been reached."
      );
    });

    it("should throw BadRequestException for booker_limit_exceeded_error_reschedule with rescheduleUid", () => {
      const error = Object.assign(new Error("booker_limit_exceeded_error_reschedule"), {
        data: { rescheduleUid: "abc123" },
      });

      expect(() => service.handleBookingError(error, false)).toThrow(BadRequestException);
      expect(() => service.handleBookingError(error, false)).toThrow(
        /You can reschedule your existing booking \(abc123\)/
      );
    });

    it("should throw BadRequestException for ZodError with formatted messages", () => {
      const zodIssues: ZodIssue[] = [
        {
          code: ZodIssueCode.invalid_type,
          expected: "string",
          received: "number",
          path: ["email"],
          message: "Expected string, received number",
        },
        {
          code: ZodIssueCode.too_small,
          minimum: 1,
          type: "string",
          inclusive: true,
          path: ["name"],
          message: "Name is required",
        },
      ];
      const zodError = new ZodError(zodIssues);

      expect(() => service.handleBookingError(zodError, false)).toThrow(BadRequestException);
      expect(() => service.handleBookingError(zodError, false)).toThrow(
        "Expected string, received number, Name is required"
      );
    });

    it("should throw BadRequestException for ZodError with single issue", () => {
      const zodIssues: ZodIssue[] = [
        {
          code: ZodIssueCode.invalid_type,
          expected: "string",
          received: "undefined",
          path: ["start"],
          message: "Start time is required",
        },
      ];
      const zodError = new ZodError(zodIssues);

      expect(() => service.handleBookingError(zodError, false)).toThrow(BadRequestException);
      expect(() => service.handleBookingError(zodError, false)).toThrow("Start time is required");
    });

    it("should rethrow unknown errors", () => {
      const error = new Error("Unknown error");

      expect(() => service.handleBookingError(error, false)).toThrow("Unknown error");
    });

    it("should rethrow non-Error objects", () => {
      const error = { message: "Not an error" };

      expect(() => service.handleBookingError(error, false)).toThrow();
    });
  });
});
