import { prisma } from "@calcom/prisma";
import { BookingStatus, MembershipRole } from "@calcom/prisma/enums";
import type { FeatureId } from "@calcom/features/flags/config";
import { FeaturesRepository } from "@calcom/features/flags/features.repository";

export const generateUniqueId = () => {
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(7);
  return `${timestamp}-${randomSuffix}`;
};

export const createTestUser = async (overrides?: { email?: string; username?: string; name?: string }) => {
  const uniqueId = generateUniqueId();
  return prisma.user.create({
    data: {
      email: overrides?.email || `test-user-${uniqueId}@example.com`,
      username: overrides?.username || `testuser-${uniqueId}`,
      name: overrides?.name || "Test User",
    },
  });
};

export const createTestOrganization = async (overrides?: { name?: string; slug?: string }) => {
  const uniqueId = generateUniqueId();
  return prisma.team.create({
    data: {
      name: overrides?.name || `Test Org ${uniqueId}`,
      slug: overrides?.slug || `test-org-${uniqueId}`,
      isOrganization: true,
    },
  });
};

export const createTestMembership = async (
  userId: number,
  teamId: number,
  overrides?: { role?: MembershipRole; accepted?: boolean }
) => {
  return prisma.membership.create({
    data: {
      userId,
      teamId,
      role: overrides?.role || MembershipRole.ADMIN,
      accepted: overrides?.accepted ?? true,
    },
  });
};

export const createTestEventType = async (
  userId: number,
  overrides?: { title?: string; slug?: string; length?: number }
) => {
  const uniqueId = generateUniqueId();
  return prisma.eventType.create({
    data: {
      title: overrides?.title || "Test Event Type",
      slug: overrides?.slug || `test-event-${uniqueId}`,
      length: overrides?.length || 60,
      userId,
    },
  });
};

export const createTestBooking = async (
  userId: number,
  eventTypeId: number,
  overrides?: {
    uid?: string;
    title?: string;
    startTime?: Date;
    endTime?: Date;
    status?: BookingStatus;
    attendees?: Array<{ email: string; name: string; timeZone: string }>;
  }
) => {
  const uniqueId = generateUniqueId();
  const startTime = overrides?.startTime || new Date();
  const endTime = overrides?.endTime || new Date(startTime.getTime() + 60 * 60 * 1000);

  return prisma.booking.create({
    data: {
      uid: overrides?.uid || `test-booking-${uniqueId}`,
      title: overrides?.title || "Test Booking",
      startTime,
      endTime,
      userId,
      eventTypeId,
      status: overrides?.status || BookingStatus.ACCEPTED,
      attendees: {
        create: overrides?.attendees || [],
      },
    },
  });
};

export const enableFeatureForOrganization = async (organizationId: number, featureSlug: string) => {
  await prisma.feature.upsert({
    where: { slug: featureSlug },
    create: {
      slug: featureSlug,
      enabled: true,
      description: `Test feature: ${featureSlug}`,
    },
    update: {
      enabled: true,
    },
  });

  const featuresRepository = new FeaturesRepository(prisma);
  await featuresRepository.setTeamFeatureState({
    teamId: organizationId,
    featureId: featureSlug as FeatureId,
    state: "enabled",
    assignedBy: "test-system",
  });
};

function cleanupLog(step: string, detail?: string) {
  const ts = new Date().toISOString();
  process.stderr.write(`[CLEANUP][pid:${process.pid}][${ts}] ${step}${detail ? ` | ${detail}` : ""}\n`);
}

export const cleanupTestData = async (testData: {
  bookingUid?: string;
  userUuids?: string[];
  attendeeEmails?: string[];
  eventTypeId?: number;
  organizationId?: number;
  userIds?: number[];
  featureSlug?: string;
}) => {
  cleanupLog("START", `bookingUid=${testData.bookingUid} userIds=${JSON.stringify(testData.userIds)}`);

  if (testData.bookingUid) {
    cleanupLog("deleting bookingAudit", testData.bookingUid);
    await prisma.bookingAudit.deleteMany({
      where: { bookingUid: testData.bookingUid },
    });
  }

  if (testData.userUuids?.length || testData.attendeeEmails?.length) {
    cleanupLog("deleting auditActor", `uuids=${JSON.stringify(testData.userUuids)} emails=${JSON.stringify(testData.attendeeEmails)}`);
    await prisma.auditActor.deleteMany({
      where: {
        OR: [
          ...(testData.userUuids?.map((uuid) => ({ userUuid: uuid })) || []),
          ...(testData.attendeeEmails?.map((email) => ({ email })) || []),
        ],
      },
    });
  }

  if (testData.attendeeEmails?.length) {
    cleanupLog("deleting attendees", JSON.stringify(testData.attendeeEmails));
    await prisma.attendee.deleteMany({
      where: { email: { in: testData.attendeeEmails } },
    });
  }

  if (testData.bookingUid) {
    cleanupLog("deleting booking", testData.bookingUid);
    await prisma.booking.deleteMany({
      where: { uid: testData.bookingUid },
    });
  }

  if (testData.eventTypeId) {
    cleanupLog("deleting eventType", String(testData.eventTypeId));
    await prisma.eventType.deleteMany({
      where: { id: testData.eventTypeId },
    });
  }

  if (testData.organizationId) {
    if (testData.featureSlug) {
      cleanupLog("deleting teamFeatures", `orgId=${testData.organizationId} feature=${testData.featureSlug}`);
      await prisma.teamFeatures.deleteMany({
        where: {
          teamId: testData.organizationId,
          featureId: testData.featureSlug,
        },
      });
    }
    cleanupLog("deleting membership", `orgId=${testData.organizationId}`);
    await prisma.membership.deleteMany({
      where: { teamId: testData.organizationId },
    });
    cleanupLog("deleting team", `orgId=${testData.organizationId}`);
    await prisma.team.deleteMany({
      where: { id: testData.organizationId },
    });
  }

  if (testData.userIds?.length) {
    cleanupLog("deleting users", JSON.stringify(testData.userIds));
    await prisma.user.deleteMany({
      where: { id: { in: testData.userIds } },
    });
  }

  cleanupLog("END", `bookingUid=${testData.bookingUid}`);
};
