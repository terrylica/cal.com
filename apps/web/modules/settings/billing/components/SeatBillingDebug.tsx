import process from "node:process";
import { getServerSession } from "@calcom/features/auth/lib/getServerSession";
import { getFeaturesRepository } from "@calcom/features/di/containers/FeaturesRepository";
import { getBillingProviderService } from "@calcom/features/ee/billing/di/containers/Billing";
import { formatMonthKey } from "@calcom/features/ee/billing/lib/month-key";
import { HighWaterMarkRepository } from "@calcom/features/ee/billing/repository/highWaterMark/HighWaterMarkRepository";
import { MonthlyProrationRepository } from "@calcom/features/ee/billing/repository/proration/MonthlyProrationRepository";
import { MonthlyProrationTeamRepository } from "@calcom/features/ee/billing/repository/proration/MonthlyProrationTeamRepository";
import { BillingPeriodService } from "@calcom/features/ee/billing/service/billingPeriod/BillingPeriodService";
import { SeatChangeTrackingService } from "@calcom/features/ee/billing/service/seatTracking/SeatChangeTrackingService";
import { UserPermissionRole } from "@calcom/prisma/enums";
import { buildLegacyRequest } from "@lib/buildLegacyCtx";
import { cookies, headers } from "next/headers";

import SeatBillingDebugClient from "./SeatBillingDebugClient";
import type {
  ActiveStrategyName,
  HealthCheck,
  HwmPrediction,
  ProrationPrediction,
  SeatBillingDebugData,
} from "./SeatBillingDebugTypes";

const MS_PER_DAY = 86_400_000;

// -- Helpers --

function daysBetween(a: Date, b: Date): number {
  return Math.ceil((b.getTime() - a.getTime()) / MS_PER_DAY);
}

function getFirstOfNextMonth(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
}

/**
 * Run multiple async calls in parallel, collecting results and errors separately.
 * Each entry is a [label, promise] tuple. Returns { results, errors } where
 * results[i] is the resolved value or null, and errors collects failure messages.
 */
async function settledAll<T extends readonly [string, Promise<unknown>][]>(
  entries: T
): Promise<{
  results: { [K in keyof T]: Awaited<T[K][1]> | null };
  errors: string[];
}> {
  const promises = entries.map(([, p]) => p);
  const settled = await Promise.allSettled(promises);
  const errors: string[] = [];
  const results = settled.map((r, i) => {
    if (r.status === "fulfilled") return r.value;
    errors.push(`${entries[i][0]}: ${r.reason}`);
    return null;
  }) as { [K in keyof T]: Awaited<T[K][1]> | null };

  return { results, errors };
}

// -- Access control --

async function canAccessDebugPanel(): Promise<boolean> {
  if (process.env.NODE_ENV === "development") return true;

  const session = await getServerSession({ req: buildLegacyRequest(await headers(), await cookies()) });
  if (!session?.user) return false;

  return (
    session.user.role === UserPermissionRole.ADMIN ||
    session.user.impersonatedBy?.role === UserPermissionRole.ADMIN
  );
}

// -- Data fetching --

async function fetchBillingData(teamId: number) {
  const featuresRepo = getFeaturesRepository();
  const monthKey = formatMonthKey(new Date());

  const { results, errors } = await settledAll([
    ["BillingPeriodService", new BillingPeriodService().getBillingPeriodInfo(teamId)],
    ["HighWaterMarkRepository", new HighWaterMarkRepository().getByTeamId(teamId)],
    ["MonthlyProrationTeamRepository", new MonthlyProrationTeamRepository().getTeamWithBilling(teamId)],
    ["Feature flag: hwm-seating", featuresRepo.checkIfFeatureIsEnabledGlobally("hwm-seating")],
    ["Feature flag: monthly-proration", featuresRepo.checkIfFeatureIsEnabledGlobally("monthly-proration")],
    ["MonthlyProrationRepository", new MonthlyProrationRepository().findByTeamAndMonth(teamId, monthKey)],
    ["SeatChangeTrackingService", new SeatChangeTrackingService().getMonthlyChanges({ teamId, monthKey })],
  ] as const);

  return {
    billingPeriodInfo: results[0],
    hwmData: results[1],
    teamWithBilling: results[2],
    hwmFeature: results[3] ?? false,
    prorationFeature: results[4] ?? false,
    prorationData: results[5],
    seatChanges: results[6] ?? { additions: 0, removals: 0, netChange: 0 },
    errors,
  };
}

async function fetchStripeData(subscriptionId: string, customerId: string) {
  const billingService = getBillingProviderService();
  const { results, errors } = await settledAll([
    ["Stripe subscription", billingService.getSubscription(subscriptionId)],
    ["Stripe invoices", billingService.listInvoices({ customerId, limit: 5 })],
  ] as const);

  const sub = results[0];
  const firstItem = sub?.items[0];
  const stripeSubscription: SeatBillingDebugData["stripeSubscription"] = sub
    ? {
        status: sub.status,
        quantity: firstItem?.quantity ?? 0,
        currentPeriodStart: new Date(sub.current_period_start * 1000).toISOString(),
        currentPeriodEnd: new Date(sub.current_period_end * 1000).toISOString(),
        pricePerSeat: firstItem?.price?.unit_amount ?? null,
      }
    : null;

  const recentInvoices: SeatBillingDebugData["recentInvoices"] = results[1]
    ? results[1].invoices.map((inv) => ({
        id: inv.id,
        amountDue: inv.amountDue,
        status: inv.status,
        created: new Date(inv.created * 1000).toISOString(),
        hostedInvoiceUrl: inv.hostedInvoiceUrl,
      }))
    : [];

  return { stripeSubscription, recentInvoices, errors };
}

// -- Strategy resolution (mirrors SeatBillingStrategyFactory.createByTeamId) --

function resolveStrategy(
  billingPeriodInfo: Awaited<ReturnType<BillingPeriodService["getBillingPeriodInfo"]>> | null,
  hwmFeature: boolean,
  prorationFeature: boolean
): { activeStrategy: ActiveStrategyName; strategyReason: string } {
  if (!billingPeriodInfo) {
    return { activeStrategy: "ImmediateUpdate", strategyReason: "Could not load billing period info" };
  }

  if (billingPeriodInfo.isInTrial) {
    return { activeStrategy: "ImmediateUpdate", strategyReason: "Team is in trial period" };
  }
  if (!billingPeriodInfo.subscriptionStart) {
    return { activeStrategy: "ImmediateUpdate", strategyReason: "No subscription start date" };
  }

  const { billingPeriod } = billingPeriodInfo;
  if (billingPeriod === "ANNUALLY" && prorationFeature) {
    return { activeStrategy: "MonthlyProration", strategyReason: "Annual plan + monthly-proration flag enabled" };
  }
  if (billingPeriod === "MONTHLY" && hwmFeature) {
    return { activeStrategy: "HighWaterMark", strategyReason: "Monthly plan + hwm-seating flag enabled" };
  }
  if (billingPeriod === "ANNUALLY") {
    return { activeStrategy: "ImmediateUpdate", strategyReason: "Annual plan but monthly-proration flag disabled" };
  }
  if (billingPeriod === "MONTHLY") {
    return { activeStrategy: "ImmediateUpdate", strategyReason: "Monthly plan but hwm-seating flag disabled" };
  }

  return { activeStrategy: "ImmediateUpdate", strategyReason: `No billing period set (period=${billingPeriod})` };
}

// -- Predictions --

function buildHwmPrediction(
  now: Date,
  stripeSubscription: NonNullable<SeatBillingDebugData["stripeSubscription"]>,
  hwmData: NonNullable<Awaited<ReturnType<HighWaterMarkRepository["getByTeamId"]>>>,
  currentMembers: number,
  pricePerSeat: number | null
): HwmPrediction {
  const periodEnd = new Date(stripeSubscription.currentPeriodEnd);
  const reconciliationDate = new Date(periodEnd.getTime() - 3 * MS_PER_DAY);
  const hwm = hwmData.highWaterMark ?? currentMembers;
  const additionalSeats = Math.max(0, hwm - stripeSubscription.quantity);

  return {
    daysUntilPeriodEnd: Math.max(0, daysBetween(now, periodEnd)),
    daysUntilReconciliation: Math.max(0, daysBetween(now, reconciliationDate)),
    reconciliationDate: reconciliationDate.toISOString(),
    pastReconciliationWindow: now >= reconciliationDate,
    expectedStripeQty: hwm,
    currentStripeQty: stripeSubscription.quantity,
    additionalSeatsCharged: additionalSeats,
    expectedCharge: pricePerSeat !== null ? additionalSeats * pricePerSeat : 0,
  };
}

function buildProrationPrediction(
  now: Date,
  stripeSubscription: NonNullable<SeatBillingDebugData["stripeSubscription"]>,
  seatChanges: { netChange: number },
  pricePerSeat: number | null,
  alreadyProcessed: boolean
): ProrationPrediction {
  const periodStart = new Date(stripeSubscription.currentPeriodStart);
  const periodEnd = new Date(stripeSubscription.currentPeriodEnd);
  const totalDaysInPeriod = Math.max(1, daysBetween(periodStart, periodEnd));
  const daysRemaining = Math.max(0, daysBetween(now, periodEnd));
  const cronRunDate = getFirstOfNextMonth(now);
  const netIncrease = seatChanges.netChange;

  return {
    daysUntilCronRun: daysBetween(now, cronRunDate),
    cronRunDate: cronRunDate.toISOString(),
    daysRemainingInPeriod: daysRemaining,
    totalDaysInPeriod,
    currentNetIncrease: netIncrease,
    estimatedAmount:
      netIncrease > 0 && pricePerSeat !== null
        ? Math.round(netIncrease * pricePerSeat * (daysRemaining / totalDaysInPeriod))
        : 0,
    willGenerateInvoice: netIncrease > 0,
    alreadyProcessedThisMonth: alreadyProcessed,
  };
}

// -- Health checks --

function buildHealthChecks(
  teamWithBilling: Awaited<ReturnType<MonthlyProrationTeamRepository["getTeamWithBilling"]>> | null,
  stripeSubscription: SeatBillingDebugData["stripeSubscription"],
  hwmData: Awaited<ReturnType<HighWaterMarkRepository["getByTeamId"]>> | null,
  billingPeriodInfo: Awaited<ReturnType<BillingPeriodService["getBillingPeriodInfo"]>> | null,
  activeStrategy: ActiveStrategyName,
  hwmFeature: boolean,
  prorationFeature: boolean,
  pricePerSeat: number | null
): HealthCheck[] {
  const checks: HealthCheck[] = [];
  const currentMembers = teamWithBilling?.memberCount ?? 0;
  const paidSeats = hwmData?.paidSeats ?? null;

  // Billing record
  checks.push(
    teamWithBilling?.billing
      ? { label: "Billing record", status: "ok", detail: "Found" }
      : { label: "Billing record", status: "error", detail: "Missing billing data for team" }
  );

  // Stripe subscription
  if (stripeSubscription) {
    checks.push({
      label: "Stripe status",
      status: stripeSubscription.status === "active" ? "ok" : "warn",
      detail: stripeSubscription.status,
    });
  } else {
    checks.push({ label: "Stripe status", status: "error", detail: "No subscription found" });
  }

  // Seat count sync
  if (stripeSubscription && paidSeats !== null) {
    const inSync = stripeSubscription.quantity === paidSeats;
    checks.push({
      label: "Seat sync",
      status: inSync ? "ok" : "warn",
      detail: inSync
        ? `Stripe qty (${stripeSubscription.quantity}) matches DB paid seats (${paidSeats})`
        : `Stripe qty (${stripeSubscription.quantity}) != DB paid seats (${paidSeats})`,
    });
  }

  // HWM tracking
  if (activeStrategy === "HighWaterMark" && hwmData) {
    const hwm = hwmData.highWaterMark;
    if (hwm !== null && hwm >= currentMembers) {
      checks.push({ label: "HWM tracking", status: "ok", detail: `HWM (${hwm}) >= current members (${currentMembers})` });
    } else if (hwm !== null) {
      checks.push({ label: "HWM tracking", status: "error", detail: `HWM (${hwm}) < current members (${currentMembers}) -- HWM should never be below current count` });
    } else {
      checks.push({ label: "HWM tracking", status: "warn", detail: "No high water mark value set" });
    }
  }

  // Feature flag consistency
  if (billingPeriodInfo?.billingPeriod === "MONTHLY" && !hwmFeature) {
    checks.push({ label: "Flag: hwm-seating", status: "warn", detail: "Monthly plan but hwm-seating flag is OFF -- using ImmediateUpdate fallback" });
  }
  if (billingPeriodInfo?.billingPeriod === "ANNUALLY" && !prorationFeature) {
    checks.push({ label: "Flag: monthly-proration", status: "warn", detail: "Annual plan but monthly-proration flag is OFF -- using ImmediateUpdate fallback" });
  }

  // Price per seat
  if (pricePerSeat === null && stripeSubscription) {
    checks.push({ label: "Price/seat", status: "warn", detail: "Could not determine price per seat -- predictions may be inaccurate" });
  }

  return checks;
}

// -- Main component --

export default async function SeatBillingDebug({ teamId }: { teamId: number }) {
  if (!teamId || Number.isNaN(teamId)) return null;
  if (!(await canAccessDebugPanel())) return null;

  const now = new Date();
  const billing = await fetchBillingData(teamId);
  const errors = [...billing.errors];

  // Stripe data (only if subscription exists)
  const subscriptionId = billing.teamWithBilling?.billing?.subscriptionId ?? null;
  const customerId = billing.teamWithBilling?.billing?.customerId ?? null;

  let stripeSubscription: SeatBillingDebugData["stripeSubscription"] = null;
  let recentInvoices: SeatBillingDebugData["recentInvoices"] = [];

  if (subscriptionId && customerId) {
    const stripe = await fetchStripeData(subscriptionId, customerId);
    stripeSubscription = stripe.stripeSubscription;
    recentInvoices = stripe.recentInvoices;
    errors.push(...stripe.errors);
  }

  const { activeStrategy, strategyReason } = resolveStrategy(
    billing.billingPeriodInfo,
    billing.hwmFeature,
    billing.prorationFeature
  );

  const currentMembers = billing.teamWithBilling?.memberCount ?? 0;
  const paidSeats = billing.hwmData?.paidSeats ?? null;
  const pricePerSeat = billing.billingPeriodInfo?.pricePerSeat ?? stripeSubscription?.pricePerSeat ?? null;

  // Predictions
  let hwmPrediction: HwmPrediction | null = null;
  if (activeStrategy === "HighWaterMark" && stripeSubscription && billing.hwmData) {
    hwmPrediction = buildHwmPrediction(now, stripeSubscription, billing.hwmData, currentMembers, pricePerSeat);
  }

  let prorationPrediction: ProrationPrediction | null = null;
  if (activeStrategy === "MonthlyProration" && stripeSubscription) {
    prorationPrediction = buildProrationPrediction(
      now,
      stripeSubscription,
      billing.seatChanges,
      pricePerSeat,
      billing.prorationData !== null
    );
  }

  const healthChecks = buildHealthChecks(
    billing.teamWithBilling,
    stripeSubscription,
    billing.hwmData,
    billing.billingPeriodInfo,
    activeStrategy,
    billing.hwmFeature,
    billing.prorationFeature,
    pricePerSeat
  );

  const data: SeatBillingDebugData = {
    teamId,
    activeStrategy,
    strategyReason,
    featureFlags: { hwmSeating: billing.hwmFeature, monthlyProration: billing.prorationFeature },
    billingPeriod: {
      period: billing.billingPeriodInfo?.billingPeriod ?? null,
      subscriptionStart: billing.billingPeriodInfo?.subscriptionStart?.toISOString() ?? null,
      subscriptionEnd: billing.billingPeriodInfo?.subscriptionEnd?.toISOString() ?? null,
      trialEnd: billing.billingPeriodInfo?.trialEnd?.toISOString() ?? null,
      isInTrial: billing.billingPeriodInfo?.isInTrial ?? false,
      pricePerSeat: billing.billingPeriodInfo?.pricePerSeat ?? null,
      isOrganization: billing.billingPeriodInfo?.isOrganization ?? false,
    },
    hwm: billing.hwmData
      ? {
          highWaterMark: billing.hwmData.highWaterMark,
          periodStart: billing.hwmData.highWaterMarkPeriodStart?.toISOString() ?? null,
          paidSeats: billing.hwmData.paidSeats,
          currentMembers,
          mismatch: billing.hwmData !== null && stripeSubscription !== null && paidSeats !== null && stripeSubscription.quantity !== paidSeats,
        }
      : null,
    proration: billing.prorationData
      ? {
          id: billing.prorationData.id,
          monthKey: billing.prorationData.monthKey,
          seatsAtStart: billing.prorationData.seatsAtStart,
          seatsAtEnd: billing.prorationData.seatsAtEnd,
          seatsAdded: billing.prorationData.seatsAdded,
          seatsRemoved: billing.prorationData.seatsRemoved,
          netSeatIncrease: billing.prorationData.netSeatIncrease,
          proratedAmount: billing.prorationData.proratedAmount,
          status: billing.prorationData.status,
          invoiceUrl: billing.prorationData.invoiceUrl,
        }
      : null,
    seatChanges: billing.seatChanges,
    stripeSubscription,
    recentInvoices,
    testClock: customerId && subscriptionId ? { customerId, subscriptionId } : null,
    predictions: { hwm: hwmPrediction, proration: prorationPrediction },
    healthChecks,
    errors,
  };

  return <SeatBillingDebugClient data={data} />;
}
