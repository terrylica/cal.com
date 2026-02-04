import prismaMock from "@calcom/testing/lib/__mocks__/prismaMock";

import type { Request, Response } from "express";
import type { NextApiRequest, NextApiResponse } from "next";
import { createMocks } from "node-mocks-http";
import { describe, expect, test, vi, afterEach, beforeEach } from "vitest";

import handler from "../../../pages/api/attendees/_get";

type CustomNextApiRequest = NextApiRequest & Request;
type CustomNextApiResponse = NextApiResponse & Response;

const userId = 1;
const adminUserId = 999;

afterEach(() => {
  vi.resetAllMocks();
});

describe("GET /api/attendees", () => {
  describe("System-wide admin", () => {
    test("should return all attendees for system-wide admin", async () => {
      const mockAttendees = [
        { id: 1, bookingId: 1, name: "John Doe", email: "john@example.com", timeZone: "UTC" },
        { id: 2, bookingId: 2, name: "Jane Smith", email: "jane@example.com", timeZone: "America/New_York" },
      ];

      prismaMock.attendee.findMany.mockResolvedValue(mockAttendees);

      const { req, res } = createMocks<CustomNextApiRequest, CustomNextApiResponse>({
        method: "GET",
        pagination: {
          take: 10,
          skip: 0,
        },
      });

      req.userId = adminUserId;
      req.isSystemWideAdmin = true;

      await handler(req, res);

      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res._getData());
      expect(data.attendees).toHaveLength(2);
      expect(prismaMock.attendee.findMany).toHaveBeenCalledWith({
        select: {
          id: true,
          bookingId: true,
          name: true,
          email: true,
          timeZone: true,
        },
        take: 10,
        skip: 0,
        orderBy: { id: "desc" },
      });
    });

    test("should throw 404 when no attendees found for admin", async () => {
      prismaMock.attendee.findMany.mockResolvedValue([]);

      const { req, res } = createMocks<CustomNextApiRequest, CustomNextApiResponse>({
        method: "GET",
        pagination: {
          take: 10,
          skip: 0,
        },
      });

      req.userId = adminUserId;
      req.isSystemWideAdmin = true;

      await handler(req, res);

      expect(res.statusCode).toBe(404);
      expect(JSON.parse(res._getData()).message).toBe("No attendees were found");
    });
  });

  describe("Regular user", () => {
    test("should only return attendees from user's own bookings", async () => {
      const userBookings = [{ id: 1 }, { id: 2 }];
      const mockAttendees = [
        { id: 1, bookingId: 1, name: "Attendee 1", email: "att1@example.com", timeZone: "UTC" },
        { id: 2, bookingId: 2, name: "Attendee 2", email: "att2@example.com", timeZone: "UTC" },
      ];

      prismaMock.booking.findMany.mockResolvedValue(userBookings as any);
      prismaMock.attendee.findMany.mockResolvedValue(mockAttendees);

      const { req, res } = createMocks<CustomNextApiRequest, CustomNextApiResponse>({
        method: "GET",
        pagination: {
          take: 10,
          skip: 0,
        },
      });

      req.userId = userId;
      req.isSystemWideAdmin = false;

      await handler(req, res);

      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res._getData());
      expect(data.attendees).toHaveLength(2);

      // Verify booking query was made for user's bookings
      expect(prismaMock.booking.findMany).toHaveBeenCalledWith({
        where: { userId },
        select: { id: true },
        orderBy: { createdAt: "desc" },
        take: 10,
        skip: 0,
      });

      // Verify attendees were filtered by booking IDs
      expect(prismaMock.attendee.findMany).toHaveBeenCalledWith({
        where: { bookingId: { in: [1, 2] } },
        select: {
          id: true,
          bookingId: true,
          name: true,
          email: true,
          timeZone: true,
        },
        orderBy: { id: "desc" },
      });
    });

    test("should throw 404 when user has no bookings with attendees", async () => {
      prismaMock.booking.findMany.mockResolvedValue([]);
      prismaMock.attendee.findMany.mockResolvedValue([]);

      const { req, res } = createMocks<CustomNextApiRequest, CustomNextApiResponse>({
        method: "GET",
        pagination: {
          take: 10,
          skip: 0,
        },
      });

      req.userId = userId;
      req.isSystemWideAdmin = false;

      await handler(req, res);

      expect(res.statusCode).toBe(404);
      expect(JSON.parse(res._getData()).message).toBe("No attendees were found");
    });

    test("should throw 404 when user has bookings but no attendees", async () => {
      const userBookings = [{ id: 1 }];

      prismaMock.booking.findMany.mockResolvedValue(userBookings as any);
      prismaMock.attendee.findMany.mockResolvedValue([]);

      const { req, res } = createMocks<CustomNextApiRequest, CustomNextApiResponse>({
        method: "GET",
        pagination: {
          take: 10,
          skip: 0,
        },
      });

      req.userId = userId;
      req.isSystemWideAdmin = false;

      await handler(req, res);

      expect(res.statusCode).toBe(404);
      expect(JSON.parse(res._getData()).message).toBe("No attendees were found");
    });
  });

  describe("Pagination", () => {
    test("should respect MAX_TAKE limit of 250", async () => {
      const mockAttendees = [{ id: 1, bookingId: 1, name: "Test", email: "test@example.com", timeZone: "UTC" }];

      prismaMock.attendee.findMany.mockResolvedValue(mockAttendees);

      const { req, res } = createMocks<CustomNextApiRequest, CustomNextApiResponse>({
        method: "GET",
        pagination: {
          take: 500, // Request more than MAX_TAKE
          skip: 0,
        },
      });

      req.userId = adminUserId;
      req.isSystemWideAdmin = true;

      await handler(req, res);

      expect(res.statusCode).toBe(200);
      // Verify take was limited to 250
      expect(prismaMock.attendee.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 250, // MAX_TAKE limit
        })
      );
    });

    test("should apply skip correctly for pagination", async () => {
      const mockAttendees = [{ id: 11, bookingId: 5, name: "Test", email: "test@example.com", timeZone: "UTC" }];

      prismaMock.attendee.findMany.mockResolvedValue(mockAttendees);

      const { req, res } = createMocks<CustomNextApiRequest, CustomNextApiResponse>({
        method: "GET",
        pagination: {
          take: 10,
          skip: 20,
        },
      });

      req.userId = adminUserId;
      req.isSystemWideAdmin = true;

      await handler(req, res);

      expect(res.statusCode).toBe(200);
      expect(prismaMock.attendee.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
          skip: 20,
        })
      );
    });

    test("should apply pagination to booking query for regular users", async () => {
      const userBookings = [{ id: 1 }];
      const mockAttendees = [{ id: 1, bookingId: 1, name: "Test", email: "test@example.com", timeZone: "UTC" }];

      prismaMock.booking.findMany.mockResolvedValue(userBookings as any);
      prismaMock.attendee.findMany.mockResolvedValue(mockAttendees);

      const { req, res } = createMocks<CustomNextApiRequest, CustomNextApiResponse>({
        method: "GET",
        pagination: {
          take: 5,
          skip: 10,
        },
      });

      req.userId = userId;
      req.isSystemWideAdmin = false;

      await handler(req, res);

      expect(res.statusCode).toBe(200);
      expect(prismaMock.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 5,
          skip: 10,
        })
      );
    });
  });

  describe("Response format", () => {
    test("should return attendees with correct fields", async () => {
      const mockAttendees = [
        {
          id: 1,
          bookingId: 100,
          name: "John Doe",
          email: "john@example.com",
          timeZone: "Europe/London",
        },
      ];

      prismaMock.attendee.findMany.mockResolvedValue(mockAttendees);

      const { req, res } = createMocks<CustomNextApiRequest, CustomNextApiResponse>({
        method: "GET",
        pagination: {
          take: 10,
          skip: 0,
        },
      });

      req.userId = adminUserId;
      req.isSystemWideAdmin = true;

      await handler(req, res);

      const data = JSON.parse(res._getData());
      expect(data.attendees[0]).toEqual({
        id: 1,
        bookingId: 100,
        name: "John Doe",
        email: "john@example.com",
        timeZone: "Europe/London",
      });
    });

    test("should order attendees by id descending", async () => {
      const mockAttendees = [
        { id: 3, bookingId: 1, name: "C", email: "c@example.com", timeZone: "UTC" },
        { id: 2, bookingId: 1, name: "B", email: "b@example.com", timeZone: "UTC" },
        { id: 1, bookingId: 1, name: "A", email: "a@example.com", timeZone: "UTC" },
      ];

      prismaMock.attendee.findMany.mockResolvedValue(mockAttendees);

      const { req, res } = createMocks<CustomNextApiRequest, CustomNextApiResponse>({
        method: "GET",
        pagination: {
          take: 10,
          skip: 0,
        },
      });

      req.userId = adminUserId;
      req.isSystemWideAdmin = true;

      await handler(req, res);

      expect(prismaMock.attendee.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { id: "desc" },
        })
      );
    });
  });
});