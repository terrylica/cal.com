import { prisma } from "@calcom/prisma";
import type { BookingStatus } from "@calcom/prisma/enums";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getBookingAuditTaskConsumer } from "../../../di/BookingAuditTaskConsumer.container";
import { getBookingAuditViewerService } from "../../../di/BookingAuditViewerService.container";
import { makeUserActor } from "../../makeActor";
import type { BookingAuditTaskConsumer } from "../BookingAuditTaskConsumer";
import type { BookingAuditViewerService } from "../BookingAuditViewerService";
import {
  cleanupTestData,
  createTestBooking,
  createTestEventType,
  createTestMembership,
  createTestOrganization,
  createTestUser,
  enableFeatureForOrganization,
} from "./integration-utils";

const FILE_ID = `no-show-${process.pid}`;
const DELETE_LOG_TABLE = `_debug_booking_deletes_${process.pid}`;

function debugLog(testName: string, message: string, data?: Record<string, unknown>) {
  const timestamp = new Date().toISOString();
  const dataStr = data ? ` | ${JSON.stringify(data)}` : "";
  process.stderr.write(`[DEBUG][${FILE_ID}][${timestamp}][${testName}] ${message}${dataStr}\n`);
}

async function setupDeleteTrigger() {
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "${DELETE_LOG_TABLE}" (
        id SERIAL PRIMARY KEY,
        deleted_booking_id INTEGER,
        deleted_booking_uid TEXT,
        deleted_booking_user_id INTEGER,
        deleted_at TIMESTAMP DEFAULT NOW(),
        pg_backend_pid INTEGER DEFAULT pg_backend_pid(),
        query_text TEXT
      )
    `);
    await prisma.$executeRawUnsafe(`
      CREATE OR REPLACE FUNCTION log_booking_delete_${process.pid}()
      RETURNS TRIGGER AS $$
      BEGIN
        INSERT INTO "${DELETE_LOG_TABLE}" (deleted_booking_id, deleted_booking_uid, deleted_booking_user_id)
        VALUES (OLD.id, OLD.uid, OLD."userId");
        RETURN OLD;
      END;
      $$ LANGUAGE plpgsql
    `);
    await prisma.$executeRawUnsafe(`
      DROP TRIGGER IF EXISTS trg_log_booking_delete_${process.pid} ON "Booking"
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TRIGGER trg_log_booking_delete_${process.pid}
      BEFORE DELETE ON "Booking"
      FOR EACH ROW
      EXECUTE FUNCTION log_booking_delete_${process.pid}()
    `);
    debugLog("setup", "PostgreSQL delete trigger installed");
  } catch (err) {
    debugLog("setup", "Failed to install delete trigger", { error: String(err) });
  }
}

async function teardownDeleteTrigger() {
  try {
    await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS trg_log_booking_delete_${process.pid} ON "Booking"`);
    await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS log_booking_delete_${process.pid}()`);
    await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "${DELETE_LOG_TABLE}"`);
    debugLog("teardown", "PostgreSQL delete trigger removed");
  } catch (err) {
    debugLog("teardown", "Failed to remove delete trigger", { error: String(err) });
  }
}

async function getDeleteLog(): Promise<unknown[]> {
  try {
    const rows = await prisma.$queryRawUnsafe(`SELECT * FROM "${DELETE_LOG_TABLE}" ORDER BY id`);
    return rows as unknown[];
  } catch {
    return [];
  }
}

async function checkBookingExists(bookingUid: string, context: string): Promise<boolean> {
  const booking = await prisma.booking.findFirst({ where: { uid: bookingUid }, select: { id: true, uid: true, userId: true } });
  const exists = booking !== null;
  debugLog("verify", `Booking check (${context}): exists=${exists}`, { bookingUid, booking: booking ?? "null" });
  return exists;
}

async function checkUserExists(userId: number, context: string): Promise<boolean> {
  const user = await prisma.user.findFirst({ where: { id: userId }, select: { id: true, email: true } });
  const exists = user !== null;
  debugLog("verify", `User check (${context}): exists=${exists}`, { userId, user: user ?? "null" });
  return exists;
}

async function dumpDiagnostics(testName: string, bookingUid: string, ownerId: number) {
  debugLog(testName, "!!! BOOKING DISAPPEARED !!! Running full diagnostics...");
  const ownerExists = await checkUserExists(ownerId, "disappeared-owner-check");
  const bookingCount = await prisma.booking.count();
  const userCount = await prisma.user.count();
  const auditRecords = await prisma.bookingAudit.findMany({
    where: { bookingUid },
    select: { id: true, bookingUid: true, action: true },
  });
  const deleteLog = await getDeleteLog();
  let pgActivity: unknown[] = [];
  try {
    pgActivity = (await prisma.$queryRawUnsafe(
      `SELECT pid, state, query, query_start, backend_start FROM pg_stat_activity WHERE state != 'idle' AND pid != pg_backend_pid() ORDER BY query_start DESC LIMIT 10`
    )) as unknown[];
  } catch { /* ignore */ }
  debugLog(testName, "DIAGNOSTICS", {
    ownerExists,
    totalBookings: bookingCount,
    totalUsers: userCount,
    auditRecordsForBooking: auditRecords,
    bookingDeleteLog: deleteLog,
    activePgQueries: pgActivity,
  });
}

describe("No-Show Updated Action Integration", () => {
  let bookingAuditTaskConsumer: BookingAuditTaskConsumer;
  let bookingAuditViewerService: BookingAuditViewerService;

  let testData: {
    owner: { id: number; uuid: string; email: string };
    attendee: { id: number; email: string };
    organization: { id: number };
    eventType: { id: number };
    booking: { id: number; uid: string; startTime: Date; endTime: Date; status: BookingStatus };
  };

  const additionalAttendeeEmails: string[] = [];
  let currentTestName = "unknown";

  beforeAll(async () => {
    debugLog("beforeAll", "=== SUITE START ===");
    await setupDeleteTrigger();
  });

  afterAll(async () => {
    await teardownDeleteTrigger();
    debugLog("afterAll", "=== SUITE END ===");
  });

  beforeEach(async () => {
    debugLog("beforeEach", "=== START beforeEach ===");

    bookingAuditTaskConsumer = getBookingAuditTaskConsumer();
    bookingAuditViewerService = getBookingAuditViewerService();

    debugLog("beforeEach", "Creating owner...");
    const owner = await createTestUser({ name: "Test Host User" });
    debugLog("beforeEach", "Owner created", { id: owner.id, uuid: owner.uuid, email: owner.email });

    debugLog("beforeEach", "Creating organization...");
    const organization = await createTestOrganization();
    debugLog("beforeEach", "Organization created", { id: organization.id });

    debugLog("beforeEach", "Creating membership...");
    await createTestMembership(owner.id, organization.id);
    debugLog("beforeEach", "Membership created");

    debugLog("beforeEach", "Enabling feature...");
    await enableFeatureForOrganization(organization.id, "booking-audit");
    debugLog("beforeEach", "Feature enabled");

    debugLog("beforeEach", "Creating event type...");
    const eventType = await createTestEventType(owner.id);
    debugLog("beforeEach", "Event type created", { id: eventType.id });

    debugLog("beforeEach", "Creating attendee user...");
    const attendee = await createTestUser({ name: "Test Attendee" });
    debugLog("beforeEach", "Attendee user created", { id: attendee.id, email: attendee.email });

    debugLog("beforeEach", "Creating booking...");
    const booking = await createTestBooking(owner.id, eventType.id, {
      attendees: [
        {
          email: attendee.email,
          name: attendee.name || "Test Attendee",
          timeZone: "UTC",
        },
      ],
    });
    debugLog("beforeEach", "Booking created", { id: booking.id, uid: booking.uid, userId: booking.userId });

    testData = {
      owner: { id: owner.id, uuid: owner.uuid, email: owner.email },
      attendee: { id: attendee.id, email: attendee.email },
      organization: { id: organization.id },
      eventType: { id: eventType.id },
      booking: {
        id: booking.id,
        uid: booking.uid,
        startTime: booking.startTime,
        endTime: booking.endTime,
        status: booking.status,
      },
    };

    await checkBookingExists(booking.uid, "end-of-beforeEach");
    await checkUserExists(owner.id, "end-of-beforeEach-owner");

    debugLog("beforeEach", "=== END beforeEach ===", {
      ownerId: owner.id,
      bookingUid: booking.uid,
      bookingId: booking.id,
    });
  });

  afterEach(async () => {
    debugLog("afterEach", `=== START afterEach (test: ${currentTestName}) ==="`);
    if (!testData) {
      debugLog("afterEach", "No testData, skipping cleanup");
      return;
    }

    await checkBookingExists(testData.booking.uid, "start-of-afterEach");
    await checkUserExists(testData.owner.id, "start-of-afterEach-owner");

    debugLog("afterEach", "Starting cleanup...", {
      bookingUid: testData.booking?.uid,
      ownerId: testData.owner?.id,
      attendeeId: testData.attendee?.id,
    });

    await cleanupTestData({
      bookingUid: testData.booking?.uid,
      userUuids: testData.owner?.uuid ? [testData.owner.uuid] : [],
      attendeeEmails: [
        ...(testData.attendee?.email ? [testData.attendee.email] : []),
        ...additionalAttendeeEmails,
      ],
      eventTypeId: testData.eventType?.id,
      organizationId: testData.organization?.id,
      userIds: [testData.owner?.id, testData.attendee?.id].filter((id): id is number => id !== undefined),
      featureSlug: "booking-audit",
    });
    additionalAttendeeEmails.length = 0;
    debugLog("afterEach", `=== END afterEach (test: ${currentTestName}) ==="`);
  });

  describe("when host is marked as no-show", () => {
    it("should create audit record with host field containing userUuid and noShow", async () => {
      currentTestName = "host-no-show";
      debugLog(currentTestName, "=== TEST START ===");

      const bookingExistsBefore = await checkBookingExists(testData.booking.uid, "test-start");
      const ownerExistsBefore = await checkUserExists(testData.owner.id, "test-start-owner");
      debugLog(currentTestName, "Pre-test verification", { bookingExistsBefore, ownerExistsBefore });

      const actor = makeUserActor(testData.owner.uuid);

      debugLog(currentTestName, "Calling onBookingAction...");
      await bookingAuditTaskConsumer.onBookingAction({
        bookingUid: testData.booking.uid,
        actor,
        action: "NO_SHOW_UPDATED",
        source: "WEBAPP",
        operationId: `op-${Date.now()}`,
        data: {
          host: {
            userUuid: testData.owner.uuid,
            noShow: { old: null, new: true },
          },
        },
        timestamp: Date.now(),
      });
      debugLog(currentTestName, "onBookingAction completed");

      const bookingExistsAfterAction = await checkBookingExists(testData.booking.uid, "before-getAuditLogs");
      const ownerExistsAfterAction = await checkUserExists(testData.owner.id, "before-getAuditLogs-owner");
      debugLog(currentTestName, "Pre-getAuditLogs verification", { bookingExistsAfterAction, ownerExistsAfterAction });

      if (!bookingExistsAfterAction) {
        await dumpDiagnostics(currentTestName, testData.booking.uid, testData.owner.id);
      }

      debugLog(currentTestName, "Calling getAuditLogsForBooking...");
      const result = await bookingAuditViewerService.getAuditLogsForBooking({
        bookingUid: testData.booking.uid,
        userId: testData.owner.id,
        userEmail: testData.owner.email,
        userTimeZone: "UTC",
        organizationId: testData.organization.id,
      });
      debugLog(currentTestName, "getAuditLogsForBooking completed", { auditLogCount: result.auditLogs.length });

      expect(result.bookingUid).toBe(testData.booking.uid);
      expect(result.auditLogs).toHaveLength(1);

      const auditLog = result.auditLogs[0];
      expect(auditLog.bookingUid).toBe(testData.booking.uid);
      expect(auditLog.action).toBe("NO_SHOW_UPDATED");
      expect(auditLog.type).toBe("RECORD_UPDATED");

      const displayData = auditLog.displayJson as Record<string, unknown>;
      expect(displayData).toBeDefined();
      expect(displayData.hostNoShow).toBe(true);
      expect(displayData.previousHostNoShow).toBe(null);
      debugLog(currentTestName, "=== TEST END ===");
    });
  });

  describe("when attendees are marked as no-show", () => {
    it("should create audit record with attendeesNoShow array", async () => {
      currentTestName = "attendees-no-show";
      debugLog(currentTestName, "=== TEST START ===");

      const bookingExistsBefore = await checkBookingExists(testData.booking.uid, "test-start");
      debugLog(currentTestName, "Pre-test verification", { bookingExistsBefore });

      const actor = makeUserActor(testData.owner.uuid);
      const attendeesNoShow = [{ attendeeEmail: testData.attendee.email, noShow: { old: null, new: true } }];

      debugLog(currentTestName, "Calling onBookingAction...");
      await bookingAuditTaskConsumer.onBookingAction({
        bookingUid: testData.booking.uid,
        actor,
        action: "NO_SHOW_UPDATED",
        source: "WEBAPP",
        operationId: `op-${Date.now()}`,
        data: { attendeesNoShow },
        timestamp: Date.now(),
      });
      debugLog(currentTestName, "onBookingAction completed");

      const bookingExistsAfterAction = await checkBookingExists(testData.booking.uid, "before-getAuditLogs");
      debugLog(currentTestName, "Pre-getAuditLogs verification", { bookingExistsAfterAction });

      if (!bookingExistsAfterAction) {
        await dumpDiagnostics(currentTestName, testData.booking.uid, testData.owner.id);
      }

      debugLog(currentTestName, "Calling getAuditLogsForBooking...");
      const result = await bookingAuditViewerService.getAuditLogsForBooking({
        bookingUid: testData.booking.uid,
        userId: testData.owner.id,
        userEmail: testData.owner.email,
        userTimeZone: "UTC",
        organizationId: testData.organization.id,
      });
      debugLog(currentTestName, "getAuditLogsForBooking completed");

      expect(result.bookingUid).toBe(testData.booking.uid);
      expect(result.auditLogs).toHaveLength(1);

      const auditLog = result.auditLogs[0];
      expect(auditLog.action).toBe("NO_SHOW_UPDATED");
      expect(auditLog.type).toBe("RECORD_UPDATED");

      const displayData = auditLog.displayJson as Record<string, unknown>;
      expect(displayData).toBeDefined();
      expect(displayData.attendeesNoShow).toBeDefined();

      const storedAttendeesNoShow = displayData.attendeesNoShow as Array<{
        attendeeEmail: string;
        noShow: { old: boolean | null; new: boolean };
      }>;
      expect(storedAttendeesNoShow).toHaveLength(1);
      expect(storedAttendeesNoShow[0].attendeeEmail).toBe(testData.attendee.email);
      expect(storedAttendeesNoShow[0].noShow.old).toBe(null);
      expect(storedAttendeesNoShow[0].noShow.new).toBe(true);
      debugLog(currentTestName, "=== TEST END ===");
    });

    it("should handle multiple attendees marked as no-show", async () => {
      currentTestName = "multiple-attendees-no-show";
      debugLog(currentTestName, "=== TEST START ===");

      const bookingExistsBefore = await checkBookingExists(testData.booking.uid, "test-start");
      const ownerExistsBefore = await checkUserExists(testData.owner.id, "test-start-owner");
      debugLog(currentTestName, "Pre-test verification", { bookingExistsBefore, ownerExistsBefore });

      const secondAttendeeEmail = `second-attendee-${Date.now()}@example.com`;
      additionalAttendeeEmails.push(secondAttendeeEmail);

      debugLog(currentTestName, "Creating second attendee...", { bookingId: testData.booking.id });
      await prisma.attendee.create({
        data: {
          email: secondAttendeeEmail,
          name: "Second Attendee",
          timeZone: "UTC",
          bookingId: testData.booking.id,
        },
      });
      debugLog(currentTestName, "Second attendee created");

      const bookingExistsAfterAttendee = await checkBookingExists(testData.booking.uid, "after-attendee-create");
      debugLog(currentTestName, "Post-attendee-create verification", { bookingExistsAfterAttendee });

      const actor = makeUserActor(testData.owner.uuid);
      const attendeesNoShow = [
        { attendeeEmail: testData.attendee.email, noShow: { old: null, new: true } },
        { attendeeEmail: secondAttendeeEmail, noShow: { old: false, new: true } },
      ];

      debugLog(currentTestName, "Calling onBookingAction...");
      await bookingAuditTaskConsumer.onBookingAction({
        bookingUid: testData.booking.uid,
        actor,
        action: "NO_SHOW_UPDATED",
        source: "WEBAPP",
        operationId: `op-${Date.now()}`,
        data: { attendeesNoShow },
        timestamp: Date.now(),
      });
      debugLog(currentTestName, "onBookingAction completed");

      const bookingExistsAfterAction = await checkBookingExists(testData.booking.uid, "before-getAuditLogs");
      const ownerExistsAfterAction = await checkUserExists(testData.owner.id, "before-getAuditLogs-owner");
      debugLog(currentTestName, "Pre-getAuditLogs verification", { bookingExistsAfterAction, ownerExistsAfterAction });

      if (!bookingExistsAfterAction) {
        await dumpDiagnostics(currentTestName, testData.booking.uid, testData.owner.id);
      }

      debugLog(currentTestName, "Calling getAuditLogsForBooking...");
      const result = await bookingAuditViewerService.getAuditLogsForBooking({
        bookingUid: testData.booking.uid,
        userId: testData.owner.id,
        userEmail: testData.owner.email,
        userTimeZone: "UTC",
        organizationId: testData.organization.id,
      });
      debugLog(currentTestName, "getAuditLogsForBooking completed");

      expect(result.auditLogs).toHaveLength(1);

      const displayData = result.auditLogs[0].displayJson as Record<string, unknown>;
      const storedAttendeesNoShow = displayData.attendeesNoShow as Array<{
        attendeeEmail: string;
        noShow: { old: boolean | null; new: boolean };
      }>;

      expect(storedAttendeesNoShow).toHaveLength(2);
      const firstAttendee = storedAttendeesNoShow.find((a) => a.attendeeEmail === testData.attendee.email);
      const secondAttendeeData = storedAttendeesNoShow.find((a) => a.attendeeEmail === secondAttendeeEmail);
      expect(firstAttendee?.noShow).toEqual({ old: null, new: true });
      expect(secondAttendeeData?.noShow).toEqual({ old: false, new: true });
      debugLog(currentTestName, "=== TEST END ===");
    });
  });

  describe("when both host and attendees are marked as no-show", () => {
    it("should create single audit record with both host and attendeesNoShow fields", async () => {
      currentTestName = "both-host-and-attendees";
      debugLog(currentTestName, "=== TEST START ===");

      const bookingExistsBefore = await checkBookingExists(testData.booking.uid, "test-start");
      debugLog(currentTestName, "Pre-test verification", { bookingExistsBefore });

      const actor = makeUserActor(testData.owner.uuid);

      debugLog(currentTestName, "Calling onBookingAction...");
      await bookingAuditTaskConsumer.onBookingAction({
        bookingUid: testData.booking.uid,
        actor,
        action: "NO_SHOW_UPDATED",
        source: "API_V2",
        operationId: `op-${Date.now()}`,
        data: {
          host: {
            userUuid: testData.owner.uuid,
            noShow: { old: null, new: true },
          },
          attendeesNoShow: [{ attendeeEmail: testData.attendee.email, noShow: { old: null, new: true } }],
        },
        timestamp: Date.now(),
      });
      debugLog(currentTestName, "onBookingAction completed");

      const bookingExistsAfterAction = await checkBookingExists(testData.booking.uid, "before-getAuditLogs");
      debugLog(currentTestName, "Pre-getAuditLogs verification", { bookingExistsAfterAction });

      if (!bookingExistsAfterAction) {
        debugLog(currentTestName, "!!! BOOKING DISAPPEARED !!!");
        const ownerExists = await checkUserExists(testData.owner.id, "booking-disappeared");
        const bookingCount = await prisma.booking.count();
        debugLog(currentTestName, "DB state", { ownerExists, totalBookings: bookingCount });
      }

      debugLog(currentTestName, "Calling getAuditLogsForBooking...");
      const result = await bookingAuditViewerService.getAuditLogsForBooking({
        bookingUid: testData.booking.uid,
        userId: testData.owner.id,
        userEmail: testData.owner.email,
        userTimeZone: "UTC",
        organizationId: testData.organization.id,
      });
      debugLog(currentTestName, "getAuditLogsForBooking completed");

      expect(result.auditLogs).toHaveLength(1);

      const auditLog = result.auditLogs[0];
      expect(auditLog.action).toBe("NO_SHOW_UPDATED");
      expect(auditLog.source).toBe("API_V2");

      const displayData = auditLog.displayJson as Record<string, unknown>;

      expect(displayData.hostNoShow).toBe(true);
      expect(displayData.previousHostNoShow).toBe(null);

      const storedAttendeesNoShow = displayData.attendeesNoShow as Array<{
        attendeeEmail: string;
        noShow: { old: boolean | null; new: boolean };
      }>;
      expect(storedAttendeesNoShow).toHaveLength(1);
      expect(storedAttendeesNoShow[0].attendeeEmail).toBe(testData.attendee.email);
      expect(storedAttendeesNoShow[0].noShow).toEqual({ old: null, new: true });
      debugLog(currentTestName, "=== TEST END ===");
    });
  });

  describe("schema validation with array format", () => {
    it("should accept attendeesNoShow data with array format", async () => {
      currentTestName = "schema-validation";
      debugLog(currentTestName, "=== TEST START ===");

      const bookingExistsBefore = await checkBookingExists(testData.booking.uid, "test-start");
      debugLog(currentTestName, "Pre-test verification", { bookingExistsBefore });

      const actor = makeUserActor(testData.owner.uuid);
      const dataWithArrayFormat = {
        attendeesNoShow: [{ attendeeEmail: testData.attendee.email, noShow: { old: null, new: true } }],
      };

      debugLog(currentTestName, "Calling onBookingAction...");
      await bookingAuditTaskConsumer.onBookingAction({
        bookingUid: testData.booking.uid,
        actor,
        action: "NO_SHOW_UPDATED",
        source: "WEBAPP",
        operationId: `op-${Date.now()}`,
        data: dataWithArrayFormat,
        timestamp: Date.now(),
      });
      debugLog(currentTestName, "onBookingAction completed");

      const bookingExistsAfterAction = await checkBookingExists(testData.booking.uid, "before-getAuditLogs");
      debugLog(currentTestName, "Pre-getAuditLogs verification", { bookingExistsAfterAction });

      if (!bookingExistsAfterAction) {
        await dumpDiagnostics(currentTestName, testData.booking.uid, testData.owner.id);
      }

      debugLog(currentTestName, "Calling getAuditLogsForBooking...");
      const result = await bookingAuditViewerService.getAuditLogsForBooking({
        bookingUid: testData.booking.uid,
        userId: testData.owner.id,
        userEmail: testData.owner.email,
        userTimeZone: "UTC",
        organizationId: testData.organization.id,
      });
      debugLog(currentTestName, "getAuditLogsForBooking completed");

      expect(result.auditLogs).toHaveLength(1);

      const displayData = result.auditLogs[0].displayJson as Record<string, unknown>;
      expect(displayData.attendeesNoShow).toBeDefined();

      const storedAttendeesNoShow = displayData.attendeesNoShow as Array<{
        attendeeEmail: string;
        noShow: { old: boolean | null; new: boolean };
      }>;
      expect(storedAttendeesNoShow).toHaveLength(1);
      expect(storedAttendeesNoShow[0].attendeeEmail).toBe(testData.attendee.email);
      debugLog(currentTestName, "=== TEST END ===");
    });
  });
});
