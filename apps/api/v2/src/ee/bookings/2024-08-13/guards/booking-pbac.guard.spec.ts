import { BookingAccessService } from "@/lib/services/booking-access.service";
import { createMock } from "@golevelup/ts-jest";
import { ExecutionContext } from "@nestjs/common";

import { BookingPbacGuard } from "./booking-pbac.guard";

describe("BookingPbacGuard", () => {
  let guard: BookingPbacGuard;
  let bookingAccessService: jest.Mocked<BookingAccessService>;

  beforeEach(() => {
    bookingAccessService = createMock<BookingAccessService>();
    guard = new BookingPbacGuard(bookingAccessService);
  });

  it("should be defined", () => {
    expect(guard).toBeDefined();
  });

  describe("canActivate", () => {
    it("should throw UnauthorizedException when user is not provided", async () => {
      const request = { user: undefined, params: { bookingUid: "abc123" } };
      const mockContext = createMockExecutionContext(request);

      await expect(guard.canActivate(mockContext)).rejects.toThrow();
    });

    it("should throw BadRequestException when bookingUid is not provided", async () => {
      const request = { user: { id: 1 }, params: {} };
      const mockContext = createMockExecutionContext(request);

      await expect(guard.canActivate(mockContext)).rejects.toThrow(
        "BookingPbacGuard - bookingUid is required"
      );
    });

    it("should return true and set pbacAuthorizedRequest when user has access to booking", async () => {
      const request: Record<string, unknown> = { user: { id: 1 }, params: { bookingUid: "abc123" } };
      const mockContext = createMockExecutionContext(request);
      bookingAccessService.doesUserIdHaveAccessToBooking.mockResolvedValue(true);

      const result = await guard.canActivate(mockContext);

      expect(result).toBe(true);
      expect(request.pbacAuthorizedRequest).toBe(true);
      expect(bookingAccessService.doesUserIdHaveAccessToBooking).toHaveBeenCalledWith({
        userId: 1,
        bookingUid: "abc123",
      });
    });

    it("should throw ForbiddenException when user does not have access to booking", async () => {
      const request = { user: { id: 1 }, params: { bookingUid: "abc123" } };
      const mockContext = createMockExecutionContext(request);
      bookingAccessService.doesUserIdHaveAccessToBooking.mockResolvedValue(false);

      await expect(guard.canActivate(mockContext)).rejects.toThrow(
        "BookingPbacGuard - user with id=1 does not have access to booking with uid=abc123"
      );
    });

    it("should use the injected bookingAccessService for access check", async () => {
      const request: Record<string, unknown> = { user: { id: 42 }, params: { bookingUid: "xyz789" } };
      const mockContext = createMockExecutionContext(request);
      bookingAccessService.doesUserIdHaveAccessToBooking.mockResolvedValue(true);

      await guard.canActivate(mockContext);

      expect(bookingAccessService.doesUserIdHaveAccessToBooking).toHaveBeenCalledTimes(1);
      expect(bookingAccessService.doesUserIdHaveAccessToBooking).toHaveBeenCalledWith({
        userId: 42,
        bookingUid: "xyz789",
      });
    });
  });

  function createMockExecutionContext(request: Record<string, unknown>): ExecutionContext {
    return createMock<ExecutionContext>({
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    });
  }
});
