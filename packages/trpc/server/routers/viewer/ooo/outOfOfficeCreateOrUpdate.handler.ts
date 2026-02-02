import { v4 as uuidv4 } from "uuid";

import { selectOOOEntries } from "@calcom/app-store/zapier/api/subscriptions/listOOOEntries";
import dayjs from "@calcom/dayjs";
import { sendBookingRedirectNotification } from "@calcom/emails/workflow-email-service";
import { CredentialRepository } from "@calcom/features/credentials/repositories/CredentialRepository";
import { MembershipRepository } from "@calcom/features/membership/repositories/MembershipRepository";
import { PrismaOOORepository } from "@calcom/features/ooo/repositories/PrismaOOORepository";
import { ProfileRepository } from "@calcom/features/profile/repositories/ProfileRepository";
import type { GetSubscriberOptions } from "@calcom/features/webhooks/lib/getWebhooks";
import getWebhooks from "@calcom/features/webhooks/lib/getWebhooks";
import type { OOOEntryPayloadType } from "@calcom/features/webhooks/lib/sendPayload";
import sendPayload from "@calcom/features/webhooks/lib/sendPayload";
import HrmsManager from "@calcom/lib/hrmsManager/hrmsManager";
import logger from "@calcom/lib/logger";
import { getTranslation } from "@calcom/lib/server/i18n";
import prisma from "@calcom/prisma";
import { WebhookTriggerEvents } from "@calcom/prisma/enums";
import type { TrpcSessionUser } from "@calcom/trpc/server/types";

import { TRPCError } from "@trpc/server";

import { isAdminForUser } from "./outOfOffice.utils";
import type { TOutOfOfficeInputSchema } from "./outOfOfficeCreateOrUpdate.schema";

const log = logger.getSubLogger({ prefix: ["[outOfOfficeCreateOrUpdate.handler]"] });

type TBookingRedirect = {
  ctx: {
    user: NonNullable<TrpcSessionUser>;
  };
  input: TOutOfOfficeInputSchema;
};

export const outOfOfficeCreateOrUpdate = async ({ ctx, input }: TBookingRedirect) => {
  const { startDate, endDate } = input.dateRange;
  if (!startDate || !endDate) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "start_date_and_end_date_required" });
  }

  const startTimeUtc = dayjs.utc(startDate).add(input.startDateOffset, "minute").startOf("day");
  const endTimeUtc = dayjs.utc(endDate).add(input.endDateOffset, "minute").endOf("day");

  if (startTimeUtc.isAfter(endTimeUtc)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "start_date_must_be_before_end_date" });
  }

  let oooUserId = ctx.user.id;
  let oooUserName = ctx.user.username;
  let oooUserEmail = ctx.user.email;
  let oooUserTimeZone = ctx.user.timeZone;
  let oooUserOrgId = ctx.user.organizationId;
  let oooUserFullName = ctx.user.name;

  let isAdmin: boolean | undefined;
  if (input.forUserId) {
    isAdmin = await isAdminForUser(ctx.user.id, input.forUserId);
    if (!isAdmin) {
      throw new TRPCError({ code: "NOT_FOUND", message: "only_admin_can_create_ooo" });
    }
    oooUserId = input.forUserId;
    const oooForUser = await prisma.user.findUnique({
      where: { id: input.forUserId },
      select: { username: true, email: true, timeZone: true, organizationId: true, name: true },
    });
    if (oooForUser) {
      oooUserEmail = oooForUser.email;
      oooUserName = oooForUser.username;
      oooUserFullName = oooForUser.name;
      oooUserTimeZone = oooForUser.timeZone;
      oooUserOrgId = oooForUser.organizationId;
    }
  }

  let toUserId: number | null = null;

  if (input.toTeamUserId === oooUserId) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "cannot_redirect_to_self" });
  }

  if (input.toTeamUserId) {
    const user = await prisma.user.findUnique({
      where: {
        id: input.toTeamUserId,
        teams: {
          some: {
            team: {
              members: {
                some: {
                  userId: oooUserId,
                  accepted: true,
                },
              },
            },
          },
        },
      },
      select: {
        id: true,
      },
    });
    if (!user) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: input.forUserId ? "forward_to_team_member_only" : "user_not_found",
      });
    }
    toUserId = user?.id;
  }

  const selectedReason = input.selectedReason;
  const reasonId: number | null = selectedReason.source === "hrms" ? null : selectedReason.id;

  const existingOutOfOfficeEntry = await prisma.outOfOfficeEntry.findFirst({
    select: {
      userId: true,
      toUserId: true,
    },
    where: {
      ...(toUserId && { userId: toUserId }),
      toUserId: oooUserId,
      OR: [
        {
          AND: [{ start: { lte: endTimeUtc.toISOString() } }, { end: { gte: startTimeUtc.toISOString() } }],
        },
        {
          AND: [{ start: { gte: startTimeUtc.toISOString() } }, { end: { lte: endTimeUtc.toISOString() } }],
        },
      ],
    },
  });

  if (existingOutOfOfficeEntry) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: input.forUserId
        ? "ooo_team_redirect_infinite_not_allowed"
        : "booking_redirect_infinite_not_allowed",
    });
  }

  const isDuplicateOutOfOfficeEntry = await prisma.outOfOfficeEntry.findFirst({
    where: {
      userId: oooUserId,
      start: startTimeUtc.toISOString(),
      end: endTimeUtc.toISOString(),
    },
  });

  if (isDuplicateOutOfOfficeEntry && isDuplicateOutOfOfficeEntry?.uuid !== input.uuid) {
    throw new TRPCError({ code: "CONFLICT", message: "out_of_office_entry_already_exists" });
  }

  const previousOutOfOfficeEntry = await prisma.outOfOfficeEntry.findUnique({
    where: {
      uuid: input.uuid ?? "",
    },
    select: {
      start: true,
      end: true,
      toUser: {
        select: {
          email: true,
          username: true,
        },
      },
    },
  });

  const createdOrUpdatedOutOfOffice = await prisma.outOfOfficeEntry.upsert({
    where: {
      uuid: input.uuid ?? "",
      userId: oooUserId,
    },
    create: {
      uuid: uuidv4(),
      start: startTimeUtc.toISOString(),
      end: endTimeUtc.toISOString(),
      notes: input.notes,
      showNotePublicly: input.showNotePublicly ?? false,
      userId: oooUserId,
      reasonId: reasonId,
      toUserId: toUserId,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    update: {
      start: startTimeUtc.toISOString(),
      end: endTimeUtc.toISOString(),
      notes: input.notes,
      ...(input.showNotePublicly !== undefined && { showNotePublicly: input.showNotePublicly }),
      userId: oooUserId,
      reasonId: reasonId,
      toUserId: toUserId ? toUserId : null,
    },
  });

  type OOOEntryResult = {
    id: number;
    start: Date;
    end: Date;
    createdAt: Date;
    updatedAt: Date;
    notes: string | null;
    showNotePublicly: boolean;
    reason: { reason: string; emoji: string | null } | null;
    reasonId: number | null;
    user: { id: number; name: string | null; email: string; timeZone: string };
    toUser: { id: number; name: string | null; email: string; timeZone: string } | null;
    uuid: string;
  };

  let resultRedirect: OOOEntryResult | null = null;
  if (createdOrUpdatedOutOfOffice) {
    const findRedirect = await prisma.outOfOfficeEntry.findUnique({
      where: {
        uuid: createdOrUpdatedOutOfOffice.uuid,
      },
      select: selectOOOEntries,
    });
    if (findRedirect) {
      resultRedirect = findRedirect;
    }
  }
  if (!resultRedirect) {
    return;
  }
  const toUser = toUserId
    ? await prisma.user.findUnique({
        where: {
          id: toUserId,
        },
        select: {
          name: true,
          username: true,
          timeZone: true,
          email: true,
        },
      })
    : null;
  const reason = reasonId
    ? await prisma.outOfOfficeReason.findUnique({
        where: {
          id: reasonId,
        },
        select: {
          reason: true,
          emoji: true,
        },
      })
    : null;
  if (toUserId) {
    const userToNotify = await prisma.user.findUnique({
      where: {
        id: toUserId,
      },
      select: {
        email: true,
        username: true,
      },
    });
    const t = await getTranslation(ctx.user.locale ?? "en", "common");
    const formattedStartDate = new Intl.DateTimeFormat("en-US").format(createdOrUpdatedOutOfOffice.start);
    const formattedEndDate = new Intl.DateTimeFormat("en-US").format(createdOrUpdatedOutOfOffice.end);

    const existingFormattedStartDate = previousOutOfOfficeEntry
      ? new Intl.DateTimeFormat("en-US").format(previousOutOfOfficeEntry.start)
      : "";
    const existingFormattedEndDate = previousOutOfOfficeEntry
      ? new Intl.DateTimeFormat("en-US").format(previousOutOfOfficeEntry.end)
      : "";

    const existingRedirectedUser = previousOutOfOfficeEntry?.toUser
      ? previousOutOfOfficeEntry.toUser
      : undefined;

    if (existingRedirectedUser && existingRedirectedUser?.email !== userToNotify?.email) {
      await sendBookingRedirectNotification({
        language: t,
        fromEmail: oooUserEmail,
        eventOwner: oooUserName || oooUserEmail,
        toEmail: existingRedirectedUser.email,
        toName: existingRedirectedUser.username || "",
        dates: `${existingFormattedStartDate} - ${existingFormattedEndDate}`,
        action: "cancel",
      });
    }

    if (userToNotify?.email) {
      if (
        existingRedirectedUser &&
        existingRedirectedUser.email === userToNotify.email &&
        (formattedStartDate !== existingFormattedStartDate || formattedEndDate !== existingFormattedEndDate)
      ) {
        await sendBookingRedirectNotification({
          language: t,
          fromEmail: oooUserEmail,
          eventOwner: oooUserName || oooUserEmail,
          toEmail: userToNotify.email,
          toName: userToNotify.username || "",
          oldDates: `${existingFormattedStartDate} - ${existingFormattedEndDate}`,
          dates: `${formattedStartDate} - ${formattedEndDate}`,
          action: "update",
        });
      } else if (
        !existingRedirectedUser ||
        (existingRedirectedUser && existingRedirectedUser.email !== userToNotify.email)
      ) {
        await sendBookingRedirectNotification({
          language: t,
          fromEmail: oooUserEmail,
          eventOwner: oooUserName || oooUserEmail,
          toEmail: userToNotify.email,
          toName: userToNotify.username || "",
          dates: `${formattedStartDate} - ${formattedEndDate}`,
          action: "add",
        });
      }
    }
  }

  const memberships = await prisma.membership.findMany({
    where: {
      userId: oooUserId,
      accepted: true,
    },
  });

  const teamIds = memberships.map((membership) => membership.teamId);

  const subscriberOptions: GetSubscriberOptions = {
    userId: oooUserId,
    teamId: teamIds,
    orgId: oooUserOrgId,
    triggerEvent: WebhookTriggerEvents.OOO_CREATED,
  };

  const subscribers = await getWebhooks(subscriberOptions);

  const payload: OOOEntryPayloadType = {
    oooEntry: {
      id: createdOrUpdatedOutOfOffice.id,
      start: dayjs(createdOrUpdatedOutOfOffice.start)
        .tz(oooUserTimeZone, true)
        .format("YYYY-MM-DDTHH:mm:ssZ"),
      end: dayjs(createdOrUpdatedOutOfOffice.end).tz(oooUserTimeZone, true).format("YYYY-MM-DDTHH:mm:ssZ"),
      createdAt: createdOrUpdatedOutOfOffice.createdAt.toISOString(),
      updatedAt: createdOrUpdatedOutOfOffice.updatedAt.toISOString(),
      notes: createdOrUpdatedOutOfOffice.notes,
      reason: {
        emoji: reason?.emoji ?? undefined,
        reason: selectedReason.source === "hrms" ? selectedReason.name : reason?.reason,
      },
      reasonId,
      user: {
        id: oooUserId,
        name: oooUserFullName,
        username: oooUserName,
        email: oooUserEmail,
        timeZone: oooUserTimeZone,
      },
      toUser: toUserId
        ? {
            id: toUserId,
            name: toUser?.name,
            username: toUser?.username,
            email: toUser?.email,
            timeZone: toUser?.timeZone,
          }
        : null,
      uuid: createdOrUpdatedOutOfOffice.uuid,
    },
  };

  await Promise.all(
    subscribers.map(async (subscriber) => {
      sendPayload(
        subscriber.secret,
        WebhookTriggerEvents.OOO_CREATED,
        dayjs().toISOString(),
        {
          appId: subscriber.appId,
          subscriberUrl: subscriber.subscriberUrl,
          payloadTemplate: subscriber.payloadTemplate,
          version: subscriber.version,
        },
        payload
      );
    })
  );

  if (selectedReason.source !== "hrms") return {};

  const hrmsReasonId = selectedReason.id;
  const hrmsReasonName = selectedReason.name;

  const oooRepo = new PrismaOOORepository(prisma);

  try {
    const orgId = await ProfileRepository.findFirstOrganizationIdForUser({ userId: oooUserId });
    const hrmsTeamIds = await MembershipRepository.findUserTeamIds({ userId: oooUserId });
    const hrmsCredential = await CredentialRepository.findFirstByAppSlug({
      userId: oooUserId,
      appSlug: "deel",
      orgId,
      teamIds: hrmsTeamIds,
    });

    if (!hrmsCredential) {
      log.warn("No HRMS credential found for user", { userId: oooUserId });
      return {};
    }

    const hrmsManager = new HrmsManager(hrmsCredential);

    const existingReference = await oooRepo.findOOOReferenceByEntryId({
      oooEntryId: createdOrUpdatedOutOfOffice.id,
    });

    if (existingReference) {
      await hrmsManager.updateOOO(existingReference.externalId, {
        endDate: endTimeUtc.format("YYYY-MM-DD"),
        startDate: startTimeUtc.format("YYYY-MM-DD"),
        notes: input?.notes ? input.notes : `Synced from Cal.com`,
        externalReasonId: hrmsReasonId,
        userEmail: oooUserEmail,
      });

      await oooRepo.updateOOOReference({
        id: existingReference.id,
        externalReasonId: hrmsReasonId,
        externalReasonName: hrmsReasonName,
        credentialId: hrmsCredential.id,
        syncedAt: new Date(),
      });

      log.info("Updated HRMS time-off request", {
        externalId: existingReference.externalId,
        oooEntryId: createdOrUpdatedOutOfOffice.id,
      });
    } else {
      const hrmsTimeOff = await hrmsManager.createOOO({
        endDate: endTimeUtc.format("YYYY-MM-DD"),
        startDate: startTimeUtc.format("YYYY-MM-DD"),
        notes: input?.notes ?? undefined,
        userEmail: oooUserEmail,
        externalReasonId: hrmsReasonId,
      });

      if (hrmsTimeOff?.id) {
        await oooRepo.createOOOReference({
          oooEntryId: createdOrUpdatedOutOfOffice.id,
          externalId: hrmsTimeOff.id,
          externalReasonId: hrmsReasonId,
          externalReasonName: hrmsReasonName,
          credentialId: hrmsCredential.id,
        });

        log.info("Created HRMS time-off request", {
          externalId: hrmsTimeOff.id,
          oooEntryId: createdOrUpdatedOutOfOffice.id,
        });
      }
    }
  } catch (error) {
    log.error("Failed to create/update HRMS time-off request", { error });
  }

  return {};
};
