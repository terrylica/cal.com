import { createHmac, timingSafeEqual } from "node:crypto";
import { CredentialRepository } from "@calcom/features/credentials/repositories/CredentialRepository";
import { MembershipRepository } from "@calcom/features/membership/repositories/MembershipRepository";
import { PrismaOOORepository } from "@calcom/features/ooo/repositories/PrismaOOORepository";
import { ProfileRepository } from "@calcom/features/profile/repositories/ProfileRepository";
import { UserRepository } from "@calcom/features/users/repositories/UserRepository";
import { IS_PRODUCTION } from "@calcom/lib/constants";
import { getErrorFromUnknown } from "@calcom/lib/errors";
import { HttpError } from "@calcom/lib/http-error";
import logger from "@calcom/lib/logger";
import { safeStringify } from "@calcom/lib/safeStringify";
import prisma from "@calcom/prisma";
import type { NextApiRequest, NextApiResponse } from "next";
import getRawBody from "raw-body";
import { z } from "zod";
import getAppKeysFromSlug from "../../_utils/getAppKeysFromSlug";
import { DeelHrmsService } from "../lib/HrmsService";
import { appKeysSchema } from "../zod";

const log = logger.getSubLogger({ prefix: ["DeelWebhook"] });

export const config = {
  api: {
    bodyParser: false,
  },
};

const deelRequesterSchema = z.object({
  id: z.string(),
  name: z.string(),
  is_employee: z.boolean(),
  work_email: z.string().nullable(),
});

const deelTimeOffResourceSchema = z.object({
  id: z.string(),
  contract_id: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  start_date: z.string(),
  end_date: z.string(),
  change_request: z.any().nullable(),
  reason: z.string().nullable(),
  type: z.string(),
  requested_at: z.string(),
  status: z.enum(["REQUESTED", "APPROVED", "REJECTED", "CANCELED", "USED"]),
  requester: deelRequesterSchema,
  reviewer: z.any().nullable(),
  start_date_is_half_day: z.boolean(),
  end_date_is_half_day: z.boolean(),
  date_is_half_day: z.boolean(),
});

const deelWebhookMetaSchema = z.object({
  event_type_id: z.string(),
  event_type: z.string(),
  tracking_id: z.string(),
  organization_id: z.string(),
  organization_name: z.string(),
});

const deelWebhookPayloadSchema = z.object({
  data: z.object({
    resource: deelTimeOffResourceSchema,
    meta: deelWebhookMetaSchema,
  }),
  timestamp: z.string(),
});

function verifyWebhookSignature(
  rawBody: Buffer<ArrayBufferLike>,
  signature: string,
  signingKey: string
): boolean {
  try {
    const expectedSignature = createHmac("sha256", signingKey).update(`POST${rawBody}`).digest("hex");

    const signatureBuffer = Buffer.from(signature, "hex");
    const expectedBuffer = Buffer.from(expectedSignature, "hex");

    if (signatureBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return timingSafeEqual(signatureBuffer, expectedBuffer);
  } catch (error) {
    log.error("Error verifying webhook signature", error);
    return false;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  try {
    if (req.method !== "POST") {
      res.status(405).json({ message: "Method Not Allowed" });
      return;
    }
    const rawBody = await getRawBody(req);
    const bodyAsString = rawBody.toString();

    const signature = req.headers["x-deel-signature"] as string;
    if (!signature) {
      res.status(400).json({ message: "Missing webhook signature" });
      return;
    }

    const appKeys = await getAppKeysFromSlug("deel");
    const parsedKeys = appKeysSchema.safeParse(appKeys);
    if (!parsedKeys.success) {
      res.status(500).json({ message: "Invalid app configuration" });
      return;
    }

    const { webhook_signing_key } = parsedKeys.data;
    if (!webhook_signing_key) {
      res.status(500).json({ message: "Webhook signing key not configured" });
      return;
    }

    const isValidSignature = verifyWebhookSignature(rawBody, signature, webhook_signing_key);
    if (!isValidSignature) {
      res.status(400).json({ message: "Invalid webhook signature" });
      return;
    }

    const parseResult = deelWebhookPayloadSchema.safeParse(JSON.parse(bodyAsString));
    if (!parseResult.success) {
      log.error("Invalid webhook payload", { issueCount: parseResult.error.issues.length });
      res.status(400).json({ statusCode: 400, message: "Invalid webhook payload" });
      return;
    }

    const payload = parseResult.data.data;
    if (payload.meta.event_type === "time-off.created" || payload.meta.event_type === "time-off.reviewed") {
      if (payload.resource.status !== "APPROVED" && payload.resource.status !== "USED") {
        res.status(200).json({ message: "Time-off not approved, skipping processing" });
        return;
      }

      const email = payload.resource.requester.work_email;
      if (!email) {
        log.warn("No work email provided in Deel webhook payload");
        res.status(200).json({ message: "No work email provided, skipping processing" });
        return;
      }

      const userRepo = new UserRepository(prisma);
      const user = await userRepo.findByEmailCaseInsensitive({ email });
      if (!user) {
        log.warn("No matching Cal.com user found for Deel webhook");
        res.status(200).json({ message: "No matching user found, skipping processing" });
        return;
      }

      const oooRepo = new PrismaOOORepository(prisma);

      const existingReference = await oooRepo.findOOOEntryByExternalReference({
        externalId: payload.resource.id,
      });
      if (existingReference) {
        log.info("OOO entry already exists for external reference, skipping creation", {
          externalId: payload.resource.id,
        });
        res.status(200).json({ message: "OOO entry already exists, skipping creation" });
        return;
      }

      const existingOOO = await oooRepo.findOOOEntriesInInterval({
        userIds: [user.id],
        startDate: new Date(payload.resource.start_date),
        endDate: new Date(payload.resource.end_date),
      });
      if (existingOOO && existingOOO.length > 0) {
        log.info("OOO entry already exists for user and date range, skipping creation", {
          userId: user.id,
          dateFrom: payload.resource.start_date,
          dateTo: payload.resource.end_date,
        });
        res.status(200).json({ message: "OOO entry already exists, skipping creation" });
        return;
      }

      const orgId = await ProfileRepository.findFirstOrganizationIdForUser({ userId: user.id });
      const teamIds = await MembershipRepository.findUserTeamIds({ userId: user.id });
      const deelCredential = await CredentialRepository.findFirstByAppSlug({
        userId: user.id,
        appSlug: "deel",
        orgId,
        teamIds,
      });
      if (!deelCredential) {
        log.warn("No Deel HRMS credential found for processing webhook");
        res.status(200).json({ message: "No Deel HRMS credential found, skipping processing" });
        return;
      }

      const deelService = new DeelHrmsService(deelCredential);
      const policies = await deelService.listOOOReasons(email);
      const matchingPolicy = policies.find(
        (policy) => policy.name.toLowerCase() === payload.resource.type.toLowerCase()
      );

      const oooEntry = await oooRepo.createOOOEntry({
        end: new Date(payload.resource.end_date),
        start: new Date(payload.resource.start_date),
        notes: payload.resource.reason,
        userId: user.id,
        uuid: crypto.randomUUID(),
        reasonId: 1,
      });

      await oooRepo.createOOOReference({
        oooEntryId: oooEntry.id,
        externalId: payload.resource.id,
        externalReasonId: matchingPolicy?.externalId || null,
        externalReasonName: payload.resource.type,
        credentialId: deelCredential.id,
      });
    } else if (payload.meta.event_type === "time-off.updated") {
      const oooRepo = new PrismaOOORepository(prisma);

      if (payload.resource.status === "CANCELED") {
        await oooRepo.deleteOOOEntryByExternalReference({
          externalId: payload.resource.id,
        });
      } else if (payload.resource.status === "APPROVED") {
        const reference = await oooRepo.findOOOEntryByExternalReference({
          externalId: payload.resource.id,
        });

        if (!reference?.oooEntry || !reference.credential) {
          log.warn("No existing OOO entry found to update for external ID", {
            externalId: payload.resource.id,
          });
          res.status(200).json({ message: "No existing OOO entry found, skipping update" });
          return;
        }

        const workEmail = payload.resource.requester.work_email;
        if (!workEmail) {
          log.warn("No work email provided in Deel webhook payload for update");
          res.status(200).json({ message: "No work email provided, skipping update" });
          return;
        }

        const deelService = new DeelHrmsService({ ...reference.credential, delegationCredentialId: null });
        const policies = await deelService.listOOOReasons(workEmail);
        const matchingPolicy = policies.find(
          (policy) => policy.name.toLowerCase() === payload.resource.type.toLowerCase()
        );

        const reason = payload.resource.reason?.startsWith("Synced from Cal.com")
          ? undefined
          : payload.resource.reason || undefined;

        await oooRepo.updateOOOEntry({
          uuid: reference.oooEntry.uuid,
          start: new Date(payload.resource.start_date),
          end: new Date(payload.resource.end_date),
          notes: reason,
          reasonId: 1,
          userId: reference.oooEntry.userId,
        });

        await oooRepo.updateOOOReference({
          id: reference.id,
          externalReasonId: matchingPolicy?.externalId || null,
          externalReasonName: payload.resource.type,
          syncedAt: new Date(),
        });
      }
    } else {
      log.info("Ignoring deel incoming webhook", { eventType: payload.meta.event_type });
    }

    res.status(200).json({ message: "Webhook processed successfully" });
  } catch (error) {
    const err = getErrorFromUnknown(error);
    log.error("Webhook processing error", safeStringify(err));

    res.status(err instanceof HttpError ? err.statusCode : 500).json({
      message: err.message,
      stack: IS_PRODUCTION ? undefined : err.stack,
    });
  }
}
