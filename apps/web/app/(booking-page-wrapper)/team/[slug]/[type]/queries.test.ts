import type { PrismaClient } from "@calcom/prisma";
import { describe, expect, it, vi } from "vitest";
import { processPublicEventData } from "./queries";

// Mock all the dependencies
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

vi.mock("@calcom/features/eventtypes/lib/getPublicEvent", () => ({
  isCurrentlyAvailable: vi.fn().mockResolvedValue(false),
  getPublicEventSelect: vi.fn(() => ({})),
  getEventTypeHosts: vi.fn(),
  getProfileFromEvent: vi.fn(),
  getUsersFromEvent: vi.fn(),
}));

vi.mock("@calcom/features/eventtypes/lib/getTeamEventType", () => ({
  getTeamEventType: vi.fn(),
}));

vi.mock("@calcom/features/ee/teams/lib/getTeamData", () => ({
  getTeamData: vi.fn(),
}));

vi.mock("@calcom/features/ee/teams/repositories/TeamRepository", () => ({
  TeamRepository: vi.fn(),
}));

vi.mock("@calcom/features/flags/features.repository", () => ({
  FeaturesRepository: vi.fn(),
}));

vi.mock("@calcom/features/users/repositories/UserRepository", () => ({
  UserRepository: vi.fn(),
}));

vi.mock("@calcom/lib/defaultAvatarImage", () => ({
  getPlaceholderAvatar: vi.fn(),
}));

vi.mock("@calcom/prisma", () => ({
  prisma: {},
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

const PROCESS_PUBLIC_EVENT_DATA_EXPECTED_KEYS = [
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
  "owner",
  "subsetOfHosts",
  "hosts",
  "profile",
  "subsetOfUsers",
  "users",
  "entity",
].sort();

describe("processPublicEventData", () => {
  const prismaMock = {
    schedule: {
      findUniqueOrThrow: vi.fn().mockResolvedValue({ availability: [] }),
    },
  } as unknown as PrismaClient;

  const mockTeamData = {
    id: 1,
    name: "Test Team",
    slug: "test-team",
    logoUrl: null,
    parent: null,
  };

  const mockEnrichedOwner = {
    id: 1,
    name: "Test Owner",
    email: "owner@test.com",
    profile: {
      organization: { id: 1, slug: "org", name: "Org" },
      organizationId: 1,
    },
  };

  const mockHosts = [
    {
      user: {
        id: 1,
        name: "Host 1",
        email: "host1@test.com",
      },
    },
  ];

  const mockUsers = [
    {
      id: 1,
      name: "User 1",
      email: "user1@test.com",
    },
  ];

  const getTestParams = (eventData: ReturnType<typeof createMockEventData>) => ({
    eventData: eventData as never,
    metadata: null,
    prisma: prismaMock,
    enrichedOwner: mockEnrichedOwner as never,
    subsetOfHosts: mockHosts as never,
    hosts: mockHosts as never,
    users: mockUsers as never,
    teamData: mockTeamData as never,
    fromRedirectOfNonOrgLink: false,
    orgSlug: null,
  });

  it("returns exactly the expected set of keys", async () => {
    const eventData = createMockEventData();

    const result = await processPublicEventData(getTestParams(eventData));

    const resultKeys = Object.keys(result).sort();
    expect(resultKeys).toEqual(PROCESS_PUBLIC_EVENT_DATA_EXPECTED_KEYS);
  });

  it("does not leak heavy fields that are queried but not needed client-side", async () => {
    const eventData = createMockEventData();

    const result = await processPublicEventData(getTestParams(eventData));

    for (const field of FIELDS_EXCLUDED_FROM_CLIENT) {
      expect(result).not.toHaveProperty(field);
    }
  });

  it("does not include workflow data in the return value", async () => {
    const eventData = createMockEventData();
    expect(eventData.workflows.length).toBeGreaterThan(0);

    const result = await processPublicEventData(getTestParams(eventData));

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

    const result = await processPublicEventData(getTestParams(eventData));

    for (const field of bookerEventFields) {
      expect(result).toHaveProperty(field);
    }
  });

  it("includes hidden field required by page components for SEO indexing", async () => {
    const eventData = createMockEventData();
    eventData.hidden = true;

    const result = await processPublicEventData(getTestParams(eventData));

    expect(result).toHaveProperty("hidden");
    expect(result.hidden).toBe(true);
  });

  it("includes team-specific fields (owner, hosts, users, entity)", async () => {
    const eventData = createMockEventData();

    const result = await processPublicEventData(getTestParams(eventData));

    expect(result).toHaveProperty("owner");
    expect(result).toHaveProperty("subsetOfHosts");
    expect(result).toHaveProperty("hosts");
    expect(result).toHaveProperty("profile");
    expect(result).toHaveProperty("subsetOfUsers");
    expect(result).toHaveProperty("users");
    expect(result).toHaveProperty("entity");
    expect(result.entity).toHaveProperty("teamSlug");
    expect(result.entity).toHaveProperty("orgSlug");
    expect(result.entity).toHaveProperty("name");
  });
});
