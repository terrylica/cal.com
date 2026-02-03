"use server";

import stripe from "@calcom/features/ee/payments/server/stripe";
import { revalidatePath } from "next/cache";

export type AdvanceTestClockResult = {
  success: boolean;
  error?: string;
  newFrozenTime?: string;
};

export async function advanceTestClock(
  testClockId: string,
  targetTime: number
): Promise<AdvanceTestClockResult> {
  // Only allow in development
  if (process.env.NODE_ENV === "production") {
    return { success: false, error: "Test clock advancement is only available in development" };
  }

  try {
    const testClock = await stripe.testHelpers.testClocks.advance(testClockId, {
      frozen_time: targetTime,
    });

    revalidatePath("/settings/teams/[id]/billing", "page");
    revalidatePath("/settings/organizations/billing", "page");

    return {
      success: true,
      newFrozenTime: new Date(testClock.frozen_time * 1000).toISOString(),
    };
  } catch (error) {
    console.error("Failed to advance test clock:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to advance test clock",
    };
  }
}

export async function advanceToBeforePeriodEnd(
  testClockId: string,
  periodEndTimestamp: number,
  daysBeforeEnd: number = 3
): Promise<AdvanceTestClockResult> {
  const targetTime = periodEndTimestamp - daysBeforeEnd * 24 * 60 * 60;
  return advanceTestClock(testClockId, targetTime);
}

export async function advancePastPeriodEnd(
  testClockId: string,
  periodEndTimestamp: number
): Promise<AdvanceTestClockResult> {
  // Advance 1 hour past period end to ensure renewal triggers
  const targetTime = periodEndTimestamp + 60 * 60;
  return advanceTestClock(testClockId, targetTime);
}
