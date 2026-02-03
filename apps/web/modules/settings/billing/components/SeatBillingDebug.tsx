"use server";

import stripe from "@calcom/features/ee/payments/server/stripe";
import { prisma } from "@calcom/prisma";
import { SeatBillingDebugClient } from "./SeatBillingDebugClient";

export interface SeatBillingDebugData {
  teamId: number;
  teamName: string;
  isOrganization: boolean;
  currentMembers: number;
  billing: {
    billingPeriod: string | null;
    paidSeats: number | null;
    highWaterMark: number | null;
    highWaterMarkPeriodStart: string | null;
    pricePerSeat: number | null;
    subscriptionId: string | null;
    subscriptionStart: string | null;
    subscriptionEnd: string | null;
  } | null;
  stripe: {
    quantity: number | null;
    status: string | null;
    currentPeriodStart: string | null;
    currentPeriodEnd: string | null;
    testClockId: string | null;
    testClockFrozenTime: string | null;
  } | null;
  seatChangeLogs: Array<{
    id: string;
    changeType: string;
    seatCount: number;
    userId: number | null;
    monthKey: string;
    createdAt: string;
  }>;
  featureFlags: {
    hwmSeating: boolean;
    monthlyProration: boolean;
  };
}

export async function fetchSeatBillingDebugData(teamId: number): Promise<SeatBillingDebugData | null> {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: {
      id: true,
      name: true,
      isOrganization: true,
      members: {
        select: { id: true },
      },
      teamBilling: {
        select: {
          billingPeriod: true,
          paidSeats: true,
          highWaterMark: true,
          highWaterMarkPeriodStart: true,
          pricePerSeat: true,
          subscriptionId: true,
          subscriptionStart: true,
          subscriptionEnd: true,
        },
      },
      organizationBilling: {
        select: {
          billingPeriod: true,
          paidSeats: true,
          highWaterMark: true,
          highWaterMarkPeriodStart: true,
          pricePerSeat: true,
          subscriptionId: true,
          subscriptionStart: true,
          subscriptionEnd: true,
        },
      },
    },
  });

  if (!team) return null;

  const billing = team.isOrganization ? team.organizationBilling : team.teamBilling;

  // Fetch Stripe subscription data
  let stripeData: SeatBillingDebugData["stripe"] = null;
  if (billing?.subscriptionId) {
    try {
      const subscription = await stripe.subscriptions.retrieve(billing.subscriptionId, {
        expand: ["test_clock"],
      });
      const testClock = subscription.test_clock as { id: string; frozen_time: number } | null;
      stripeData = {
        quantity: subscription.items.data[0]?.quantity ?? null,
        status: subscription.status,
        currentPeriodStart: new Date(subscription.current_period_start * 1000).toISOString(),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
        testClockId: testClock?.id ?? null,
        testClockFrozenTime: testClock ? new Date(testClock.frozen_time * 1000).toISOString() : null,
      };
    } catch (error) {
      console.error("Failed to fetch Stripe subscription:", error);
    }
  }

  // Fetch recent seat change logs
  const seatChangeLogs = await prisma.seatChangeLog.findMany({
    where: { teamId },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      changeType: true,
      seatCount: true,
      userId: true,
      monthKey: true,
      createdAt: true,
    },
  });

  // Fetch feature flags
  const hwmFlag = await prisma.feature.findUnique({
    where: { slug: "hwm-seating" },
    select: { enabled: true },
  });
  const prorationFlag = await prisma.feature.findUnique({
    where: { slug: "monthly-proration" },
    select: { enabled: true },
  });

  return {
    teamId: team.id,
    teamName: team.name,
    isOrganization: team.isOrganization,
    currentMembers: team.members.length,
    billing: billing
      ? {
          billingPeriod: billing.billingPeriod,
          paidSeats: billing.paidSeats,
          highWaterMark: billing.highWaterMark,
          highWaterMarkPeriodStart: billing.highWaterMarkPeriodStart?.toISOString() ?? null,
          pricePerSeat: billing.pricePerSeat,
          subscriptionId: billing.subscriptionId,
          subscriptionStart: billing.subscriptionStart?.toISOString() ?? null,
          subscriptionEnd: billing.subscriptionEnd?.toISOString() ?? null,
        }
      : null,
    stripe: stripeData,
    seatChangeLogs: seatChangeLogs.map((log) => ({
      id: log.id,
      changeType: log.changeType,
      seatCount: log.seatCount,
      userId: log.userId,
      monthKey: log.monthKey,
      createdAt: log.createdAt.toISOString(),
    })),
    featureFlags: {
      hwmSeating: hwmFlag?.enabled ?? false,
      monthlyProration: prorationFlag?.enabled ?? false,
    },
  };
}

interface SeatBillingDebugProps {
  teamId: number;
}

export async function SeatBillingDebug({ teamId }: SeatBillingDebugProps) {
  const data = await fetchSeatBillingDebugData(teamId);

  if (!data) {
    return null;
  }

  return <SeatBillingDebugClient data={data} teamId={teamId} />;
}
