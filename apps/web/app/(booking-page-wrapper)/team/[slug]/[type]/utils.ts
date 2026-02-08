import type { LocationObject } from "@calcom/app-store/locations";
import { privacyFilteredLocations } from "@calcom/app-store/locations";
import type { eventTypeMetaDataSchemaWithTypedApps } from "@calcom/app-store/zod-utils";
import { getBookingFieldsWithSystemFields } from "@calcom/features/bookings/lib/getBookingFields";
import type {
  getEventTypeHosts,
  getPublicEventSelect,
  getUsersFromEvent,
} from "@calcom/features/eventtypes/lib/getPublicEvent";
import { getProfileFromEvent, isCurrentlyAvailable } from "@calcom/features/eventtypes/lib/getPublicEvent";
import type { UserRepository } from "@calcom/features/users/repositories/UserRepository";
import { getPlaceholderAvatar } from "@calcom/lib/defaultAvatarImage";
import { isRecurringEvent, parseRecurringEvent } from "@calcom/lib/isRecurringEvent";
import { markdownToSafeHTML } from "@calcom/lib/markdownToSafeHTML";
import type { Prisma, PrismaClient } from "@calcom/prisma/client";
import { bookerLayouts as bookerLayoutsSchema, customInputSchema } from "@calcom/prisma/zod-utils";
import type { getCachedTeamData } from "./queries";

/**
 * Processes team event data and enriches it with all necessary fields for the booking page.
 * @internal - Exported for testing purposes only
 */
export async function processTeamEventData({
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
