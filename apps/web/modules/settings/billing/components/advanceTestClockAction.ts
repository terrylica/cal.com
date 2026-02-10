"use server";

import process from "node:process";
import { getServerSession } from "@calcom/features/auth/lib/getServerSession";
import stripe from "@calcom/features/ee/payments/server/stripe";
import { UserPermissionRole } from "@calcom/prisma/enums";
import { buildLegacyRequest } from "@lib/buildLegacyCtx";
import { cookies, headers } from "next/headers";

async function assertCanAccessDebug() {
  if (process.env.NODE_ENV === "development") return;

  const session = await getServerSession({ req: buildLegacyRequest(await headers(), await cookies()) });
  const isInstanceAdmin = session?.user?.role === UserPermissionRole.ADMIN;
  const isImpersonatedByAdmin = session?.user?.impersonatedBy?.role === UserPermissionRole.ADMIN;

  if (!isInstanceAdmin && !isImpersonatedByAdmin) {
    throw new Error("Test clock actions require instance admin access");
  }
}

async function getTestClockId(customerId: string): Promise<string> {
  const customer = await stripe.customers.retrieve(customerId);
  if ("deleted" in customer && customer.deleted) {
    throw new Error("Customer has been deleted");
  }
  const testClockId = customer.test_clock;
  if (!testClockId) {
    throw new Error("No test clock attached to this customer");
  }
  return typeof testClockId === "string" ? testClockId : testClockId.id;
}

export async function advanceTestClock(
  customerId: string,
  advanceToTimestamp: number
): Promise<{ success: boolean; error?: string }> {
  await assertCanAccessDebug();
  try {
    const testClockId = await getTestClockId(customerId);
    await stripe.testHelpers.testClocks.advance(testClockId, {
      frozen_time: advanceToTimestamp,
    });
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function advanceToBeforePeriodEnd(
  customerId: string,
  periodEnd: number,
  daysBefore: number
): Promise<{ success: boolean; error?: string }> {
  await assertCanAccessDebug();
  try {
    const targetTimestamp = periodEnd - daysBefore * 24 * 60 * 60;
    const testClockId = await getTestClockId(customerId);
    await stripe.testHelpers.testClocks.advance(testClockId, {
      frozen_time: targetTimestamp,
    });
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function advancePastPeriodEnd(
  customerId: string,
  periodEnd: number
): Promise<{ success: boolean; error?: string }> {
  await assertCanAccessDebug();
  try {
    const targetTimestamp = periodEnd + 60;
    const testClockId = await getTestClockId(customerId);
    await stripe.testHelpers.testClocks.advance(testClockId, {
      frozen_time: targetTimestamp,
    });
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}
