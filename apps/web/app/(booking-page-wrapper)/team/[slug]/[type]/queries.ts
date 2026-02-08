import process from "node:process";
import type { LocationObject } from "@calcom/app-store/locations";
import { privacyFilteredLocations } from "@calcom/app-store/locations";
import { eventTypeMetaDataSchemaWithTypedApps } from "@calcom/app-store/zod-utils";
import { getBookingFieldsWithSystemFields } from "@calcom/features/bookings/lib/getBookingFields";
import { getTeamData } from "@calcom/features/ee/teams/lib/getTeamData";
import { TeamRepository } from "@calcom/features/ee/teams/repositories/TeamRepository";
import {
  getEventTypeHosts,
  getProfileFromEvent,
  type getPublicEventSelect,
  getUsersFromEvent,
  isCurrentlyAvailable,
} from "@calcom/features/eventtypes/lib/getPublicEvent";
import { getTeamEventType } from "@calcom/features/eventtypes/lib/getTeamEventType";
import { FeaturesRepository } from "@calcom/features/flags/features.repository";
import { UserRepository } from "@calcom/features/users/repositories/UserRepository";
import { NEXTJS_CACHE_TTL } from "@calcom/lib/constants";
import { getPlaceholderAvatar } from "@calcom/lib/defaultAvatarImage";
import { isRecurringEvent, parseRecurringEvent } from "@calcom/lib/isRecurringEvent";
import { markdownToSafeHTML } from "@calcom/lib/markdownToSafeHTML";
import { prisma } from "@calcom/prisma";
import type { Prisma, PrismaClient } from "@calcom/prisma/client";
import type { SchedulingType } from "@calcom/prisma/enums";
import { bookerLayouts as bookerLayoutsSchema, customInputSchema } from "@calcom/prisma/zod-utils";
import type { GetServerSidePropsContext } from "next";
import { unstable_cache } from "next/cache";

/**
 * @internal - Exported for testing purposes only
 */
export async function _processTeamEventData({
  eventData,
  metadata,
  prisma,
  enrichedOwner,
  subsetOfHosts,
  hosts,
  users,
  teamData,
  fromRedirectOfNonOrgLink,
  orgSlug,
}: {
  eventData: Prisma.EventTypeGetPayload<{ select: ReturnType<typeof getPublicEventSelect> }>;
  metadata: ReturnType<typeof eventTypeMetaDataSchemaWithTypedApps.parse>;
  prisma: PrismaClient;
  enrichedOwner: Awaited<ReturnType<UserRepository["enrichUserWithItsProfile"]>> | null;
  subsetOfHosts: Awaited<ReturnType<typeof getEventTypeHosts>>["subsetOfHosts"];
  hosts: Awaited<ReturnType<typeof getEventTypeHosts>>["hosts"];
  users: Awaited<ReturnType<typeof getUsersFromEvent>>;
  teamData: NonNullable<Awaited<ReturnType<typeof getCachedTeamData>>>;
  fromRedirectOfNonOrgLink: boolean;
  orgSlug: string | null;
}) {
  let showInstantEventConnectNowModal = eventData.isInstantEvent ?? false;
  if (eventData.isInstantEvent && eventData.instantMeetingSchedule?.id) {
    const { id, timeZone } = eventData.instantMeetingSchedule;
    showInstantEventConnectNowModal = await isCurrentlyAvailable({
      prisma,
      instantMeetingScheduleId: id,
      availabilityTimezone: timeZone ?? "Europe/London",
      length: eventData.length,
    });
  }

  const name = teamData.parent?.name ?? teamData.name ?? null;
  const isUnpublished = teamData.parent ? !teamData.parent.slug : !teamData.slug;

  return {
    id: eventData.id,
    title: eventData.title,
    slug: eventData.slug,
    schedulingType: eventData.schedulingType,
    length: eventData.length,
    enablePerHostLocations: eventData.enablePerHostLocations,
    lockTimeZoneToggleOnBookingPage: eventData.lockTimeZoneToggleOnBookingPage,
    lockedTimeZone: eventData.lockedTimeZone,
    requiresConfirmation: eventData.requiresConfirmation,
    requiresBookerEmailVerification: eventData.requiresBookerEmailVerification,
    autoTranslateDescriptionEnabled: eventData.autoTranslateDescriptionEnabled,
    fieldTranslations: eventData.fieldTranslations,
    price: eventData.price,
    currency: eventData.currency,
    seatsPerTimeSlot: eventData.seatsPerTimeSlot,
    seatsShowAvailabilityCount: eventData.seatsShowAvailabilityCount,
    forwardParamsSuccessRedirect: eventData.forwardParamsSuccessRedirect,
    successRedirectUrl: eventData.successRedirectUrl,
    redirectUrlOnNoRoutingFormResponse: eventData.redirectUrlOnNoRoutingFormResponse,
    disableGuests: eventData.disableGuests,
    hidden: eventData.hidden,
    team: eventData.team,
    schedule: eventData.schedule,
    isInstantEvent: eventData.isInstantEvent,
    instantMeetingParameters: eventData.instantMeetingParameters,
    aiPhoneCallConfig: eventData.aiPhoneCallConfig,
    assignAllTeamMembers: eventData.assignAllTeamMembers,
    disableCancelling: eventData.disableCancelling,
    disableRescheduling: eventData.disableRescheduling,
    allowReschedulingCancelledBookings: eventData.allowReschedulingCancelledBookings,
    interfaceLanguage: eventData.interfaceLanguage,
    bookerLayouts: bookerLayoutsSchema.parse(metadata?.bookerLayouts || null),
    description: markdownToSafeHTML(eventData.description),
    metadata,
    customInputs: customInputSchema.array().parse(eventData.customInputs || []),
    locations: privacyFilteredLocations((eventData.locations || []) as LocationObject[]),
    bookingFields: getBookingFieldsWithSystemFields(eventData),
    recurringEvent: isRecurringEvent(eventData.recurringEvent)
      ? parseRecurringEvent(eventData.recurringEvent)
      : null,
    isDynamic: false,
    showInstantEventConnectNowModal,
    owner: enrichedOwner,
    subsetOfHosts,
    hosts,
    profile: getProfileFromEvent({ ...eventData, owner: enrichedOwner, subsetOfHosts, hosts }),
    subsetOfUsers: users,
    users,
    entity: {
      fromRedirectOfNonOrgLink,
      considerUnpublished: isUnpublished && !fromRedirectOfNonOrgLink,
      orgSlug,
      teamSlug: teamData.slug ?? null,
      name,
      hideProfileLink: false,
      logoUrl: teamData.parent
        ? getPlaceholderAvatar(teamData.parent.logoUrl, teamData.parent.name)
        : getPlaceholderAvatar(teamData.logoUrl, teamData.name),
    },
  };
}

export async function getCachedTeamData(teamSlug: string, orgSlug: string | null) {
  return unstable_cache(async () => getTeamData(teamSlug, orgSlug), ["team-data", teamSlug, orgSlug ?? ""], {
    revalidate: NEXTJS_CACHE_TTL,
    tags: [`team:${orgSlug ? `${orgSlug}:` : ""}${teamSlug}`],
  })();
}

export async function getCachedTeamEventType(teamSlug: string, meetingSlug: string, orgSlug: string | null) {
  return unstable_cache(
    async () => getTeamEventType(teamSlug, meetingSlug, orgSlug),
    ["team-event-type", teamSlug, meetingSlug, orgSlug ?? ""],
    {
      revalidate: NEXTJS_CACHE_TTL,
      tags: [`event-type:${orgSlug ? `${orgSlug}:` : ""}${teamSlug}:${meetingSlug}`],
    }
  )();
}

export async function getEnrichedEventType({
  teamSlug,
  meetingSlug,
  orgSlug,
  fromRedirectOfNonOrgLink,
}: {
  teamSlug: string;
  meetingSlug: string;
  orgSlug: string | null;
  fromRedirectOfNonOrgLink: boolean;
}) {
  const [teamData, eventType] = await Promise.all([
    getCachedTeamData(teamSlug, orgSlug),
    getCachedTeamEventType(teamSlug, meetingSlug, orgSlug),
  ]);

  if (!teamData || !eventType) {
    return null;
  }

  const { subsetOfHosts, hosts } = await getEventTypeHosts({
    hosts: eventType.hosts,
    prisma,
  });

  const enrichedOwner = eventType.owner
    ? await new UserRepository(prisma).enrichUserWithItsProfile({
        user: eventType.owner,
      })
    : null;
  const users =
    (await getUsersFromEvent({ ...eventType, owner: enrichedOwner, subsetOfHosts, hosts }, prisma)) ?? [];

  const eventMetaData = eventTypeMetaDataSchemaWithTypedApps.parse(eventType.metadata);

  return _processTeamEventData({
    eventData: eventType,
    metadata: eventMetaData,
    prisma,
    enrichedOwner,
    subsetOfHosts,
    hosts,
    users,
    teamData,
    fromRedirectOfNonOrgLink,
    orgSlug,
  });
}

export async function shouldUseApiV2ForTeamSlots(teamId: number): Promise<boolean> {
  const featureRepo = new FeaturesRepository(prisma);
  const teamHasApiV2Route = await featureRepo.checkIfTeamHasFeature(teamId, "use-api-v2-for-team-slots");
  const useApiV2 = teamHasApiV2Route && Boolean(process.env.NEXT_PUBLIC_API_V2_URL);

  return useApiV2;
}

export async function getCRMData(
  query: GetServerSidePropsContext["query"],
  eventData: {
    id: number;
    isInstantEvent: boolean;
    schedulingType: SchedulingType | null;
    metadata: Prisma.JsonValue | null;
    length: number;
  }
) {
  const crmContactOwnerEmail = query["cal.crmContactOwnerEmail"];
  const crmContactOwnerRecordType = query["cal.crmContactOwnerRecordType"];
  const crmAppSlugParam = query["cal.crmAppSlug"];
  const crmRecordIdParam = query["cal.crmRecordId"];
  const crmLookupDoneParam = query["cal.crmLookupDone"];

  let teamMemberEmail = Array.isArray(crmContactOwnerEmail) ? crmContactOwnerEmail[0] : crmContactOwnerEmail;
  let crmOwnerRecordType = Array.isArray(crmContactOwnerRecordType)
    ? crmContactOwnerRecordType[0]
    : crmContactOwnerRecordType;
  let crmAppSlug = Array.isArray(crmAppSlugParam) ? crmAppSlugParam[0] : crmAppSlugParam;
  let crmRecordId = Array.isArray(crmRecordIdParam) ? crmRecordIdParam[0] : crmRecordIdParam;

  // If crmLookupDone is true, the router already performed the CRM lookup, so skip it here
  const crmLookupDone =
    (Array.isArray(crmLookupDoneParam) ? crmLookupDoneParam[0] : crmLookupDoneParam) === "true";

  if (!crmLookupDone && (!teamMemberEmail || !crmOwnerRecordType || !crmAppSlug)) {
    const { getTeamMemberEmailForResponseOrContactUsingUrlQuery } = await import(
      "@calcom/features/ee/teams/lib/getTeamMemberEmailFromCrm"
    );
    const {
      email,
      recordType,
      crmAppSlug: crmAppSlugQuery,
      recordId: crmRecordIdQuery,
    } = await getTeamMemberEmailForResponseOrContactUsingUrlQuery({
      query,
      eventData,
    });

    teamMemberEmail = email ?? undefined;
    crmOwnerRecordType = recordType ?? undefined;
    crmAppSlug = crmAppSlugQuery ?? undefined;
    crmRecordId = crmRecordIdQuery ?? undefined;
  }

  return {
    teamMemberEmail,
    crmOwnerRecordType,
    crmAppSlug,
    crmRecordId,
  };
}

export async function getTeamId(teamSlug: string, orgSlug: string | null): Promise<number | null> {
  const teamRepo = new TeamRepository(prisma);
  const team = await teamRepo.findFirstBySlugAndParentSlug({
    slug: teamSlug,
    parentSlug: orgSlug,
    select: { id: true },
  });

  return team?.id ?? null;
}
