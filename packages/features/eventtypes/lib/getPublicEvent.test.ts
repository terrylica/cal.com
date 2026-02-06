import { describe, it, expect, vi, beforeEach } from "vitest";

import type { PrismaClient } from "@calcom/prisma";

import { processEventDataShared, getPublicEvent } from "./getPublicEvent";

vi.mock("@calcom/features/bookings/lib/getBookingFields", () => ({
  getBookingFieldsWithSystemFields: vi.fn().mockReturnValue([]),
}));

vi.mock("@calcom/app-store/locations", () => ({
  privacyFilteredLocations: vi.fn((locs: unknown) => locs),
}));

vi.mock("@calcom/lib/isRecurringEvent", () => ({
  isRecurringEvent: vi.fn().mockReturnValue(false),
  parseRecurringEvent: vi.fn().mockReturnValue(null),
}));

vi.mock("@calcom/lib/markdownToSafeHTML", () => ({
  markdownToSafeHTML: vi.fn((s: string) => s),
}));

vi.mock("@calcom/lib/defaultAvatarImage", () => ({
  getPlaceholderAvatar: vi.fn((_url: unknown, name: unknown) => name),
  getOrgOrTeamAvatar: vi.fn(() => "avatar-url"),
}));

vi.mock("@calcom/lib/getAvatarUrl", () => ({
  getUserAvatarUrl: vi.fn(() => "user-avatar-url"),
}));

vi.mock("@calcom/features/users/repositories/UserRepository", () => {
  class MockUserRepository {
    enrichUsersWithTheirProfiles(users: unknown[]) {
      return Promise.resolve(
        users.map((u: Record<string, unknown>) => ({
          ...u,
          profile: {
            organization: { id: 1, slug: "org", name: "Org" },
            organizationId: 1,
          },
        }))
      );
    }
    enrichUserWithItsProfile({ user }: { user: Record<string, unknown> }) {
      return Promise.resolve({
        ...user,
        profile: {
          organization: { id: 1, slug: "org", name: "Org" },
          organizationId: 1,
        },
      });
    }
  }
  return { UserRepository: MockUserRepository };
});

vi.mock("@calcom/features/ee/organizations/lib/getBookerBaseUrlSync", () => ({
  getBookerBaseUrlSync: vi.fn(() => "https://app.cal.com"),
}));

vi.mock("@calcom/features/ee/organizations/lib/orgDomains", () => ({
  getSlugOrRequestedSlug: vi.fn((slug: string) => ({ slug })),
}));

vi.mock("@calcom/features/eventtypes/lib/defaultEvents", () => ({
  getDefaultEvent: vi.fn(),
  getUsernameList: vi.fn((u: string) => [u]),
}));

vi.mock("@calcom/features/pbac/services/permission-check.service", () => ({
  PermissionCheckService: vi.fn().mockImplementation(() => ({
    checkPermission: vi.fn().mockResolvedValue(false),
  })),
}));

function createMockEventData() {
  return {
    id: 1,
    title: "Test Event",
    description: "Test description",
    interfaceLanguage: null,
    eventName: "test-event",
    slug: "test-event",
    isInstantEvent: false,
    instantMeetingParameters: [],
    aiPhoneCallConfig: null,
    schedulingType: null,
    length: 30,
    locations: [],
    enablePerHostLocations: false,
    customInputs: [],
    disableGuests: false,
    metadata: null,
    lockTimeZoneToggleOnBookingPage: false,
    lockedTimeZone: null,
    requiresConfirmation: false,
    autoTranslateDescriptionEnabled: false,
    fieldTranslations: [],
    requiresBookerEmailVerification: false,
    recurringEvent: null,
    price: 0,
    currency: "usd",
    seatsPerTimeSlot: null,
    disableCancelling: false,
    disableRescheduling: false,
    minimumRescheduleNotice: 0,
    allowReschedulingCancelledBookings: false,
    seatsShowAvailabilityCount: null,
    bookingFields: [],
    teamId: null,
    team: null,
    successRedirectUrl: null,
    forwardParamsSuccessRedirect: null,
    redirectUrlOnNoRoutingFormResponse: null,
    workflows: [
      {
        id: 1,
        eventTypeId: 1,
        workflowId: 1,
        workflow: {
          id: 1,
          name: "Test Workflow",
          userId: 1,
          teamId: null,
          trigger: "BEFORE_EVENT",
          time: 24,
          timeUnit: "HOUR",
          isActiveOnAll: false,
          steps: [
            {
              id: 1,
              stepNumber: 1,
              action: "SMS_NUMBER",
              workflowId: 1,
              sendTo: "+1234567890",
              reminderBody: "This is a long reminder body that adds to payload size",
              emailSubject: "This is a long email subject that adds to payload size",
              template: "CUSTOM",
              numberRequired: true,
              sender: "Cal.com",
              numberVerificationPending: false,
              includeCalendarEvent: false,
            },
          ],
        },
      },
    ],
    hosts: [
      {
        user: {
          id: 1,
          avatarUrl: null,
          username: "testuser",
          name: "Test User",
          weekStart: "Monday",
          brandColor: "#000",
          darkBrandColor: "#fff",
          theme: null,
          metadata: null,
          organization: null,
          defaultScheduleId: null,
        },
      },
    ],
    owner: {
      id: 1,
      avatarUrl: null,
      username: "testuser",
      name: "Test User",
      weekStart: "Monday",
      brandColor: "#000",
      darkBrandColor: "#fff",
      theme: null,
      metadata: null,
      organization: null,
      defaultScheduleId: null,
    },
    schedule: { id: 1, timeZone: "UTC" },
    instantMeetingSchedule: null,
    periodType: "UNLIMITED",
    periodDays: null,
    periodEndDate: null,
    periodStartDate: null,
    periodCountCalendarDays: null,
    hidden: false,
    assignAllTeamMembers: false,
    rescheduleWithSameRoundRobinHost: false,
    parent: null,
  };
}

const FIELDS_EXCLUDED_FROM_CLIENT = [
  "periodType",
  "periodDays",
  "periodEndDate",
  "periodStartDate",
  "periodCountCalendarDays",
  "parent",
  "instantMeetingSchedule",
  "rescheduleWithSameRoundRobinHost",
  "eventName",
  "teamId",
  "minimumRescheduleNotice",
] as const;

const PROCESS_EVENT_DATA_SHARED_EXPECTED_KEYS = [
  "id",
  "title",
  "slug",
  "schedulingType",
  "length",
  "enablePerHostLocations",
  "lockTimeZoneToggleOnBookingPage",
  "lockedTimeZone",
  "requiresConfirmation",
  "requiresBookerEmailVerification",
  "autoTranslateDescriptionEnabled",
  "fieldTranslations",
  "price",
  "currency",
  "seatsPerTimeSlot",
  "seatsShowAvailabilityCount",
  "forwardParamsSuccessRedirect",
  "successRedirectUrl",
  "redirectUrlOnNoRoutingFormResponse",
  "disableGuests",
  "hidden",
  "team",
  "schedule",
  "isInstantEvent",
  "instantMeetingParameters",
  "aiPhoneCallConfig",
  "assignAllTeamMembers",
  "disableCancelling",
  "disableRescheduling",
  "allowReschedulingCancelledBookings",
  "interfaceLanguage",
  "bookerLayouts",
  "description",
  "metadata",
  "customInputs",
  "locations",
  "bookingFields",
  "recurringEvent",
  "isDynamic",
  "showInstantEventConnectNowModal",
].sort();

const GET_PUBLIC_EVENT_EXPECTED_KEYS= [
  ...PROCESS_EVENT_DATA_SHARED_EXPECTED_KEYS.filter(
    (k) => k !== "showInstantEventConnectNowModal" && k !== "isDynamic"
  ),
  "owner",
  "subsetOfHosts",
  "hosts",
  "profile",
  "subsetOfUsers",
  "users",
  "entity",
  "isDynamic",
  "showInstantEventConnectNowModal",
].sort();

describe("processEventDataShared", () => {
  const prismaMock = {
    schedule: {
      findUniqueOrThrow: vi.fn().mockResolvedValue({ availability: [] }),
    },
  } as unknown as PrismaClient;

  it("returns exactly the expected set of keys", async () => {
    const eventData = createMockEventData();

    const result = await processEventDataShared({
      eventData: eventData as never,
      metadata: null,
      prisma: prismaMock,
    });

    const resultKeys = Object.keys(result).sort();
    expect(resultKeys).toEqual(PROCESS_EVENT_DATA_SHARED_EXPECTED_KEYS);
  });

  it("does not leak heavy fields that are queried but not needed client-side", async () => {
    const eventData = createMockEventData();

    const result = await processEventDataShared({
      eventData: eventData as never,
      metadata: null,
      prisma: prismaMock,
    });

    for (const field of FIELDS_EXCLUDED_FROM_CLIENT) {
      expect(result).not.toHaveProperty(field);
    }
  });

  it("does not include workflow data in the return value", async () => {
    const eventData = createMockEventData();
    expect(eventData.workflows.length).toBeGreaterThan(0);

    const result = await processEventDataShared({
      eventData: eventData as never,
      metadata: null,
      prisma: prismaMock,
    });

    expect(result).not.toHaveProperty("workflows");
    const resultStr = JSON.stringify(result);
    expect(resultStr).not.toContain("reminderBody");
    expect(resultStr).not.toContain("emailSubject");
    expect(resultStr).not.toContain("This is a long reminder body");
  });

  it("includes all fields required by BookerEvent type", async () => {
    const bookerEventFields = [
      "id",
      "length",
      "slug",
      "schedulingType",
      "recurringEvent",
      "locations",
      "enablePerHostLocations",
      "metadata",
      "isDynamic",
      "requiresConfirmation",
      "price",
      "currency",
      "lockTimeZoneToggleOnBookingPage",
      "lockedTimeZone",
      "schedule",
      "seatsPerTimeSlot",
      "title",
      "description",
      "forwardParamsSuccessRedirect",
      "successRedirectUrl",
      "bookingFields",
      "seatsShowAvailabilityCount",
      "isInstantEvent",
      "instantMeetingParameters",
      "fieldTranslations",
      "autoTranslateDescriptionEnabled",
      "disableCancelling",
      "disableRescheduling",
      "interfaceLanguage",
      "team",
    ];

    const eventData = createMockEventData();

    const result = await processEventDataShared({
      eventData: eventData as never,
      metadata: null,
      prisma: prismaMock,
    });

    for (const field of bookerEventFields) {
      expect(result).toHaveProperty(field);
    }
  });

  it("includes hidden field required by page components for SEO indexing", async () => {
    const eventData = createMockEventData();
    eventData.hidden = true;

    const result = await processEventDataShared({
      eventData: eventData as never,
      metadata: null,
      prisma: prismaMock,
    });

    expect(result).toHaveProperty("hidden");
    expect(result.hidden).toBe(true);
  });
});

describe("getPublicEvent", () => {
  let prismaMock: Record<string, unknown>;

  beforeEach(() => {
    const mockEventData = createMockEventData();

    prismaMock = {
      eventType: {
        findFirst: vi.fn().mockResolvedValue(mockEventData),
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          users: [
            {
              id: 1,
              avatarUrl: null,
              username: "testuser",
              name: "Test User",
              weekStart: "Monday",
            },
          ],
        }),
      },
      schedule: {
        findUnique: vi.fn().mockResolvedValue({ id: 1, timeZone: "UTC" }),
        findUniqueOrThrow: vi.fn().mockResolvedValue({ availability: [] }),
      },
      team: {
        findFirst: vi.fn().mockResolvedValue(null),
        findFirstOrThrow: vi.fn().mockResolvedValue({ logoUrl: null, name: "Org" }),
      },
    };
  });

  it("returns exactly the expected set of keys for a non-team event", async () => {
    const result = await getPublicEvent(
      "testuser",
      "test-event",
      false,
      null,
      prismaMock as unknown as PrismaClient,
      false,
      undefined,
      false
    );

    expect(result).not.toBeNull();
    const resultKeys = Object.keys(result!).sort();
    expect(resultKeys).toEqual(GET_PUBLIC_EVENT_EXPECTED_KEYS);
  });

  it("does not leak heavy fields that are queried but not needed client-side", async () => {
    const result = await getPublicEvent(
      "testuser",
      "test-event",
      false,
      null,
      prismaMock as unknown as PrismaClient,
      false,
      undefined,
      false
    );

    expect(result).not.toBeNull();
    for (const field of FIELDS_EXCLUDED_FROM_CLIENT) {
      expect(result).not.toHaveProperty(field);
    }
  });

  it("does not include workflow data in the return value", async () => {
    const result = await getPublicEvent(
      "testuser",
      "test-event",
      false,
      null,
      prismaMock as unknown as PrismaClient,
      false,
      undefined,
      false
    );

    expect(result).not.toBeNull();
    expect(result).not.toHaveProperty("workflows");
    const resultStr = JSON.stringify(result);
    expect(resultStr).not.toContain("reminderBody");
    expect(resultStr).not.toContain("emailSubject");
  });

  it("includes all fields required by BookerEvent type and page components", async () => {
    const requiredFields = [
      "id",
      "title",
      "slug",
      "length",
      "schedulingType",
      "recurringEvent",
      "entity",
      "locations",
      "enablePerHostLocations",
      "metadata",
      "isDynamic",
      "requiresConfirmation",
      "price",
      "currency",
      "lockTimeZoneToggleOnBookingPage",
      "lockedTimeZone",
      "schedule",
      "seatsPerTimeSlot",
      "description",
      "forwardParamsSuccessRedirect",
      "successRedirectUrl",
      "subsetOfHosts",
      "bookingFields",
      "seatsShowAvailabilityCount",
      "isInstantEvent",
      "instantMeetingParameters",
      "fieldTranslations",
      "autoTranslateDescriptionEnabled",
      "disableCancelling",
      "disableRescheduling",
      "interfaceLanguage",
      "team",
      "owner",
      "hidden",
      "profile",
      "subsetOfUsers",
      "showInstantEventConnectNowModal",
    ];

    const result = await getPublicEvent(
      "testuser",
      "test-event",
      false,
      null,
      prismaMock as unknown as PrismaClient,
      false,
      undefined,
      false
    );

    expect(result).not.toBeNull();
    for (const field of requiredFields) {
      expect(result).toHaveProperty(field);
    }
  });

  it("includes hidden field required by page components for SEO robots meta", async () => {
    const result = await getPublicEvent(
      "testuser",
      "test-event",
      false,
      null,
      prismaMock as unknown as PrismaClient,
      false,
      undefined,
      false
    );

    expect(result).not.toBeNull();
    expect(result).toHaveProperty("hidden");
  });

  it("includes workflows when includeWorkflows is true", async () => {
    const result = await getPublicEvent(
      "testuser",
      "test-event",
      false,
      null,
      prismaMock as unknown as PrismaClient,
      false,
      undefined,
      false,
      true
    );

    expect(result).not.toBeNull();
    expect(result).toHaveProperty("workflows");
    expect(Array.isArray(result!.workflows)).toBe(true);
    expect(result!.workflows.length).toBeGreaterThan(0);
  });
});
