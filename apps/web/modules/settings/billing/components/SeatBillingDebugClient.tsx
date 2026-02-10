"use client";

import { Alert } from "@calcom/ui/components/alert";
import { Badge } from "@calcom/ui/components/badge";
import { Button } from "@calcom/ui/components/button";
import { Icon } from "@calcom/ui/components/icon";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@calcom/ui/components/sheet";
import { Tooltip } from "@calcom/ui/components/tooltip";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { advancePastPeriodEnd, advanceTestClock, advanceToBeforePeriodEnd } from "./advanceTestClockAction";
import type {
  ActiveStrategyName,
  HealthCheck,
  HealthStatus,
  SeatBillingDebugData,
} from "./SeatBillingDebugTypes";

// -- Constants --

const STRATEGY_BADGE_VARIANT: Record<ActiveStrategyName, "success" | "blue" | "purple"> = {
  ImmediateUpdate: "success",
  HighWaterMark: "blue",
  MonthlyProration: "purple",
};

const STRATEGY_LABELS: Record<ActiveStrategyName, string> = {
  ImmediateUpdate: "Immediate Update",
  HighWaterMark: "High Water Mark (HWM)",
  MonthlyProration: "Monthly Proration",
};

const STRATEGY_DESCRIPTIONS: Record<ActiveStrategyName, string> = {
  ImmediateUpdate:
    "Stripe is updated immediately when seats change. The customer is charged or credited right away for any seat additions or removals.",
  HighWaterMark:
    "Tracks the highest number of seats used during a billing cycle. At the end of the period, the customer is charged for the peak usage, not the current count. Seats can be removed without reducing the bill until the next cycle.",
  MonthlyProration:
    "For annual plans. Seat changes are tracked throughout the month, and on the 1st of each month a prorated invoice is generated based on how many days the extra seats were used within the billing period.",
};

const HEALTH_BADGE_VARIANT: Record<HealthStatus, "success" | "orange" | "error"> = {
  ok: "success",
  warn: "orange",
  error: "error",
};

// -- Primitives --

function InfoTip({ content }: { content: string }) {
  return (
    <Tooltip content={content} side="top">
      <span className="text-subtle hover:text-emphasis inline-flex cursor-help">
        <Icon name="info" size={14} />
      </span>
    </Tooltip>
  );
}

function Muted({ children }: { children: React.ReactNode }) {
  return <p className="text-subtle text-xs">{children}</p>;
}

function KV({ label, value, hint, warn }: { label: string; value: React.ReactNode; hint?: string; warn?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2 py-0.5">
      <span className="text-subtle inline-flex items-center gap-1 text-xs font-medium">
        {label}
        {hint && <InfoTip content={hint} />}
      </span>
      <span className="text-emphasis flex items-center gap-1.5 text-xs font-semibold">
        {value ?? "N/A"}
        {warn && (
          <Badge variant="orange" size="sm">
            mismatch
          </Badge>
        )}
      </span>
    </div>
  );
}

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-subtle bg-default rounded-lg border p-3">
      <h4 className="text-emphasis mb-2 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide">
        {title}
        {description && <InfoTip content={description} />}
      </h4>
      {children}
    </div>
  );
}

function HealthCheckRow({ check }: { check: HealthCheck }) {
  return (
    <div className="flex items-start gap-2 py-1">
      <Badge variant={HEALTH_BADGE_VARIANT[check.status]} size="sm" className="mt-0.5 shrink-0">
        {check.status}
      </Badge>
      <div className="min-w-0">
        <span className="text-emphasis text-xs font-medium">{check.label}</span>
        <p className="text-subtle text-xs">{check.detail}</p>
      </div>
    </div>
  );
}

// -- Formatters --

function formatCents(cents: number | null): string {
  if (cents === null) return "N/A";
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "N/A";
  return new Date(iso).toLocaleString();
}

function formatShortDate(iso: string | null): string {
  if (!iso) return "N/A";
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// -- Sections --

function StrategySection({ data }: { data: SeatBillingDebugData }) {
  return (
    <SectionCard title="Billing Strategy" description={STRATEGY_DESCRIPTIONS[data.activeStrategy]}>
      <div className="mb-2 flex items-center gap-2">
        <Badge variant={STRATEGY_BADGE_VARIANT[data.activeStrategy]}>
          {STRATEGY_LABELS[data.activeStrategy]}
        </Badge>
        {data.billingPeriod.isOrganization && (
          <Badge variant="gray" size="sm">
            Org
          </Badge>
        )}
      </div>
      <KV label="Why this strategy?" value={data.strategyReason} />
      <div className="mt-2 flex flex-wrap gap-2">
        <Badge variant={data.featureFlags.hwmSeating ? "success" : "error"} withDot>
          hwm-seating
        </Badge>
        <Badge variant={data.featureFlags.monthlyProration ? "success" : "error"} withDot>
          monthly-proration
        </Badge>
      </div>
    </SectionCard>
  );
}

function HwmPredictionSection({ data }: { data: SeatBillingDebugData }) {
  const pred = data.predictions.hwm;
  if (!pred) return null;

  return (
    <SectionCard
      title="What happens at renewal"
      description="HWM billing charges for the highest seat count reached during the billing cycle. About 3 days before the period ends, Stripe receives a webhook that adjusts the subscription quantity to the high water mark.">
      <div className="space-y-1">
        {pred.pastReconciliationWindow ? (
          <Alert
            severity="warning"
            title="Inside reconciliation window"
            message="The invoice.upcoming webhook may have already fired. Stripe quantity should update soon."
          />
        ) : (
          <KV
            label="Reconciliation fires in"
            value={`${pred.daysUntilReconciliation} days (${formatShortDate(pred.reconciliationDate)})`}
            hint="This is when Stripe will be told to update the subscription quantity to match the high water mark."
          />
        )}
        <KV
          label="Stripe quantity will change"
          value={
            pred.currentStripeQty === pred.expectedStripeQty
              ? `${pred.currentStripeQty} (no change)`
              : `${pred.currentStripeQty} -> ${pred.expectedStripeQty}`
          }
          hint="Current Stripe subscription quantity vs. what it will be set to at reconciliation."
        />
        <KV
          label="Additional seats to be charged"
          value={pred.additionalSeatsCharged}
          hint="The difference between the high water mark and what Stripe currently has. Only positive differences result in charges."
        />
        <KV
          label="Expected charge"
          value={formatCents(pred.expectedCharge)}
          hint="Additional seats multiplied by the per-seat price. This is the extra amount on the next invoice."
        />
        <KV
          label="Period ends in"
          value={`${pred.daysUntilPeriodEnd} days`}
        />
        {pred.additionalSeatsCharged === 0 && (
          <Alert
            severity="info"
            message="No extra charge expected -- the high water mark matches what Stripe already has."
          />
        )}
      </div>
    </SectionCard>
  );
}

function ProrationPredictionSection({ data }: { data: SeatBillingDebugData }) {
  const pred = data.predictions.proration;
  if (!pred) return null;

  return (
    <SectionCard
      title="What happens next month"
      description="Monthly proration runs a cron job on the 1st of each month. It looks at how many seats were added or removed, then generates a prorated invoice based on how many days remain in the annual billing period.">
      <div className="space-y-1">
        {pred.alreadyProcessedThisMonth ? (
          <Alert
            severity="info"
            title="Already processed"
            message="The proration cron has already run for this month. Any further seat changes will be included in next month's run."
          />
        ) : (
          <KV
            label="Cron runs in"
            value={`${pred.daysUntilCronRun} days (${formatShortDate(pred.cronRunDate)})`}
            hint="On this date, the system will calculate prorated charges for seat changes made this month."
          />
        )}
        <KV
          label="Net seat change this month"
          value={pred.currentNetIncrease > 0 ? `+${pred.currentNetIncrease}` : String(pred.currentNetIncrease)}
          hint="Total seats added minus seats removed this month. Only net increases generate an invoice."
        />
        <KV
          label="Days remaining in annual period"
          value={`${pred.daysRemainingInPeriod} of ${pred.totalDaysInPeriod}`}
          hint="The proration formula: (net new seats) x (price per seat) x (days remaining / total days in period)."
        />
        <KV
          label="Estimated prorated invoice"
          value={formatCents(pred.estimatedAmount)}
          hint="Approximate amount that will appear on the next proration invoice. Actual amount may differ slightly."
        />
        {pred.willGenerateInvoice ? (
          <Alert
            severity="warning"
            title="Invoice will be generated"
            message={`Based on +${pred.currentNetIncrease} net seats, an invoice of approximately ${formatCents(pred.estimatedAmount)} will be created on ${formatShortDate(pred.cronRunDate)}.`}
          />
        ) : (
          <Alert
            severity="info"
            message="No net seat increase this month, so no proration invoice will be created."
          />
        )}
      </div>
    </SectionCard>
  );
}

function SeatOverviewSection({ data }: { data: SeatBillingDebugData }) {
  return (
    <SectionCard
      title="Seat Overview"
      description="A snapshot of seat counts across the database and Stripe. Mismatches between Stripe and the DB may be expected depending on the billing strategy.">
      <KV
        label="Current Members"
        value={data.hwm?.currentMembers ?? "?"}
        hint="Actual number of members in the team right now."
      />
      <KV
        label="Stripe Quantity"
        value={data.stripeSubscription?.quantity ?? "N/A"}
        warn={
          data.hwm !== null &&
          data.stripeSubscription !== null &&
          data.hwm.paidSeats !== null &&
          data.stripeSubscription.quantity !== data.hwm.paidSeats
        }
        hint="The number of seats Stripe is currently billing for. May differ from DB under HWM strategy."
      />
      <KV
        label="Paid Seats (DB)"
        value={data.hwm?.paidSeats ?? "N/A"}
        hint="The seat count stored in our database. Should match Stripe for Immediate Update strategy."
      />
      {data.activeStrategy === "HighWaterMark" && (
        <KV
          label="High Water Mark"
          value={data.hwm?.highWaterMark ?? "N/A"}
          hint="The peak number of seats reached this billing cycle. This is what Stripe will be updated to at reconciliation."
        />
      )}
      <div className="border-subtle mt-2 border-t pt-2">
        <p className="text-subtle mb-1 text-[11px] font-medium uppercase tracking-wide">This month's changes</p>
        <KV label="Seats added" value={`+${data.seatChanges.additions}`} />
        <KV label="Seats removed" value={`-${data.seatChanges.removals}`} />
        <KV
          label="Net change"
          value={data.seatChanges.netChange > 0 ? `+${data.seatChanges.netChange}` : String(data.seatChanges.netChange)}
        />
      </div>
    </SectionCard>
  );
}

function BillingPeriodSection({ data }: { data: SeatBillingDebugData }) {
  return (
    <SectionCard title="Billing Period">
      <KV
        label="Plan type"
        value={data.billingPeriod.period}
        hint="MONTHLY plans use HWM billing. ANNUALLY plans use monthly proration."
      />
      <KV label="Subscription started" value={formatDate(data.billingPeriod.subscriptionStart)} />
      <KV label="Subscription ends" value={formatDate(data.billingPeriod.subscriptionEnd)} />
      <KV
        label="Trial"
        value={
          data.billingPeriod.isInTrial
            ? `Yes (ends ${formatDate(data.billingPeriod.trialEnd)})`
            : "No"
        }
        hint={data.billingPeriod.isInTrial ? "During trial, Immediate Update is used regardless of feature flags." : undefined}
      />
      <KV label="Price per seat" value={formatCents(data.billingPeriod.pricePerSeat)} />
    </SectionCard>
  );
}

function HwmDetailsSection({ data }: { data: SeatBillingDebugData }) {
  if (data.activeStrategy !== "HighWaterMark" || !data.hwm) return null;

  return (
    <SectionCard
      title="HWM Record"
      description="The high water mark record tracks the peak seat count for this billing cycle. It resets at the start of each new billing period.">
      <KV
        label="High Water Mark"
        value={data.hwm.highWaterMark}
        hint="The maximum number of seats used at any point during this billing cycle."
      />
      <KV
        label="Period start"
        value={formatDate(data.hwm.periodStart)}
        hint="When this HWM tracking period began (usually the billing cycle start date)."
      />
      <KV
        label="Paid seats (DB)"
        value={data.hwm.paidSeats}
        hint="What our database thinks Stripe is billing for. Updated at reconciliation."
      />
    </SectionCard>
  );
}

function ProrationRecordSection({ data }: { data: SeatBillingDebugData }) {
  if (data.activeStrategy !== "MonthlyProration") return null;

  return (
    <SectionCard
      title="Proration Record"
      description="Shows the proration calculation for the current month. A new record is created each time the monthly cron runs.">
      {data.proration ? (
        <>
          <KV label="Month" value={data.proration.monthKey} />
          <KV
            label="Seats at start / end"
            value={`${data.proration.seatsAtStart} -> ${data.proration.seatsAtEnd}`}
            hint="Seat count when the month started vs. when the cron ran."
          />
          <KV
            label="Added / Removed"
            value={`+${data.proration.seatsAdded} / -${data.proration.seatsRemoved}`}
          />
          <KV
            label="Net increase"
            value={data.proration.netSeatIncrease}
            hint="Only net increases generate a prorated charge."
          />
          <KV
            label="Prorated amount"
            value={formatCents(data.proration.proratedAmount)}
            hint="The calculated prorated charge for the seat changes this month."
          />
          <KV label="Status" value={data.proration.status} />
          {data.proration.invoiceUrl && (
            <Button
              href={data.proration.invoiceUrl}
              target="_blank"
              color="secondary"
              size="sm"
              EndIcon="external-link"
              className="mt-1.5">
              View Invoice
            </Button>
          )}
        </>
      ) : (
        <Muted>No proration record exists for the current month yet. One will be created when the cron runs on the 1st.</Muted>
      )}
    </SectionCard>
  );
}

function StripeSection({ data }: { data: SeatBillingDebugData }) {
  return (
    <SectionCard title="Stripe Subscription" description="Raw data from the Stripe subscription object.">
      {data.stripeSubscription ? (
        <>
          <KV label="Status" value={data.stripeSubscription.status} />
          <KV
            label="Quantity"
            value={data.stripeSubscription.quantity}
            hint="The number of seats Stripe is billing for right now."
          />
          <KV label="Current period start" value={formatDate(data.stripeSubscription.currentPeriodStart)} />
          <KV label="Current period end" value={formatDate(data.stripeSubscription.currentPeriodEnd)} />
          <KV label="Price per seat" value={formatCents(data.stripeSubscription.pricePerSeat)} />
        </>
      ) : (
        <Muted>No Stripe subscription found for this team.</Muted>
      )}
    </SectionCard>
  );
}

function InvoicesSection({ data }: { data: SeatBillingDebugData }) {
  return (
    <SectionCard title="Recent Invoices" description="The last 5 invoices from Stripe for this customer.">
      {data.recentInvoices.length > 0 ? (
        <div className="divide-subtle divide-y">
          {data.recentInvoices.map((inv) => (
            <div key={inv.id} className="flex items-center justify-between py-1.5">
              <div className="text-xs">
                <span className="text-subtle">{formatDate(inv.created)}</span>
                <span className="text-emphasis ml-2 font-medium">{formatCents(inv.amountDue)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Badge variant={inv.status === "paid" ? "success" : "gray"} size="sm">
                  {inv.status ?? "unknown"}
                </Badge>
                {inv.hostedInvoiceUrl && (
                  <Button
                    href={inv.hostedInvoiceUrl}
                    target="_blank"
                    variant="icon"
                    color="minimal"
                    size="sm"
                    StartIcon="external-link"
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Muted>No invoices found.</Muted>
      )}
    </SectionCard>
  );
}

function TestClockSection({
  data,
  onAdvance,
  actionResult,
}: {
  data: SeatBillingDebugData;
  onAdvance: (action: () => Promise<{ success: boolean; error?: string }>) => void;
  actionResult: string | null;
}) {
  const periodEndUnix = data.stripeSubscription
    ? Math.floor(new Date(data.stripeSubscription.currentPeriodEnd).getTime() / 1000)
    : null;

  return (
    <SectionCard
      title="Test Clock Controls"
      description="Advance the Stripe test clock to simulate time passing. Only works with Stripe test mode customers that have a test clock attached.">
      {data.testClock ? (
        <div className="flex flex-col gap-2">
          {periodEndUnix ? (
            <>
              <div className="flex items-center gap-1.5">
                <Button
                  color="secondary"
                  size="sm"
                  className="flex-1 justify-center"
                  onClick={() =>
                    onAdvance(() =>
                      advanceToBeforePeriodEnd(data.testClock!.customerId, periodEndUnix, 3)
                    )
                  }>
                  Advance to 3d before period end
                </Button>
                <InfoTip content="Triggers the invoice.upcoming webhook, which causes HWM reconciliation." />
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  color="secondary"
                  size="sm"
                  className="flex-1 justify-center"
                  onClick={() =>
                    onAdvance(() => advancePastPeriodEnd(data.testClock!.customerId, periodEndUnix))
                  }>
                  Advance past period end
                </Button>
                <InfoTip content="Ends the current billing cycle and starts a new one." />
              </div>
              <div className="flex gap-1.5">
                <input
                  type="datetime-local"
                  id="custom-advance-time"
                  className="border-default text-emphasis rounded-md border px-2 py-1 text-xs"
                />
                <Button
                  color="secondary"
                  size="sm"
                  onClick={() => {
                    const input = document.getElementById("custom-advance-time") as HTMLInputElement;
                    if (input?.value) {
                      const ts = Math.floor(new Date(input.value).getTime() / 1000);
                      onAdvance(() => advanceTestClock(data.testClock!.customerId, ts));
                    }
                  }}>
                  Custom
                </Button>
              </div>
            </>
          ) : (
            <Muted>No Stripe period data available for time controls.</Muted>
          )}
          {actionResult && (
            <Alert
              severity={actionResult.startsWith("Error") ? "error" : "info"}
              message={actionResult}
            />
          )}
        </div>
      ) : (
        <Muted>No customer/subscription found, or the customer does not have a test clock attached.</Muted>
      )}
    </SectionCard>
  );
}

// -- Main component --

export default function SeatBillingDebugClient({ data }: { data: SeatBillingDebugData }) {
  const [open, setOpen] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [actionResult, setActionResult] = useState<string | null>(null);
  const router = useRouter();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (autoRefresh && open) {
      intervalRef.current = setInterval(() => {
        startTransition(() => router.refresh());
      }, 5000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [autoRefresh, open, router]);

  const handleAdvance = useCallback(
    async (action: () => Promise<{ success: boolean; error?: string }>) => {
      setActionResult(null);
      const result = await action();
      if (result.success) {
        setActionResult("Advanced successfully");
        startTransition(() => router.refresh());
      } else {
        setActionResult(`Error: ${result.error}`);
      }
    },
    [router]
  );

  const hasIssues = data.healthChecks.some((c) => c.status !== "ok");
  const errorCount = data.healthChecks.filter((c) => c.status === "error").length;
  const warnCount = data.healthChecks.filter((c) => c.status === "warn").length;

  return (
    <>
      {/* Floating trigger */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">
        <Button
          color="secondary"
          size="sm"
          StartIcon="code"
          onClick={() => setOpen(true)}
          className="shadow-lg">
          <span className="font-semibold">Billing Debug</span>
          <Badge variant={STRATEGY_BADGE_VARIANT[data.activeStrategy]} size="sm" className="ml-1.5">
            {STRATEGY_LABELS[data.activeStrategy]}
          </Badge>
          {hasIssues && (
            <Badge variant={errorCount > 0 ? "error" : "orange"} size="sm" className="ml-1">
              {errorCount > 0 ? `${errorCount} err` : `${warnCount} warn`}
            </Badge>
          )}
        </Button>
      </div>

      {/* Sheet panel */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Seat Billing Inspector</SheetTitle>
            <Muted>
              This panel shows how seat billing is configured for Team {data.teamId} and what to expect
              at the next billing event.
            </Muted>
          </SheetHeader>

          <SheetBody className="flex flex-col gap-3">
            {/* Errors */}
            {data.errors.length > 0 && (
              <Alert
                severity="error"
                title="Some data could not be loaded"
                message={
                  <ul className="list-inside list-disc text-xs">
                    {data.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                }
              />
            )}

            {/* Health Checks */}
            <SectionCard
              title="Health Checks"
              description="Quick checks to verify billing is set up correctly. Green means OK, orange is a warning, red needs attention.">
              <div className="divide-subtle divide-y">
                {data.healthChecks.map((check, i) => (
                  <HealthCheckRow key={i} check={check} />
                ))}
              </div>
            </SectionCard>

            {/* Predictions */}
            <HwmPredictionSection data={data} />
            <ProrationPredictionSection data={data} />

            {/* Strategy */}
            <StrategySection data={data} />

            {/* Seats */}
            <SeatOverviewSection data={data} />

            {/* Billing Period */}
            <BillingPeriodSection data={data} />

            {/* Strategy-specific details */}
            <HwmDetailsSection data={data} />
            <ProrationRecordSection data={data} />

            {/* Stripe raw data */}
            <StripeSection data={data} />
            <InvoicesSection data={data} />

            {/* Test clock */}
            <TestClockSection data={data} onAdvance={handleAdvance} actionResult={actionResult} />
          </SheetBody>

          <SheetFooter>
            <div className="flex w-full items-center justify-between">
              <label className="text-subtle flex items-center gap-1.5 text-xs">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="border-default rounded"
                />
                Auto-refresh (5s)
              </label>
              <Button
                color="secondary"
                size="sm"
                StartIcon="refresh-cw"
                onClick={() => startTransition(() => router.refresh())}
                loading={isPending}>
                Refresh
              </Button>
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}
