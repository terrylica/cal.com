"use client";

import { Alert, AlertDescription, AlertTitle } from "@coss/ui/components/alert";
import { Badge } from "@coss/ui/components/badge";
import { Button } from "@coss/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@coss/ui/components/card";
import { Separator } from "@coss/ui/components/separator";
import {
  Sheet,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetPanel,
  SheetPopup,
  SheetTitle,
} from "@coss/ui/components/sheet";
import { Tabs, TabsList, TabsPanel, TabsTab } from "@coss/ui/components/tabs";
import { Tooltip, TooltipPopup, TooltipTrigger } from "@coss/ui/components/tooltip";
import { cn } from "@coss/ui/lib/utils";
import {
  ChevronDownIcon,
  ChevronUpIcon,
  CreditCardIcon,
  DownloadIcon,
  ExternalLinkIcon,
  InfoIcon,
  RefreshCwIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";

import { advancePastPeriodEnd, advanceTestClock, advanceToBeforePeriodEnd } from "./advanceTestClockAction";
import {
  cancelSubscription,
  endTrialNow,
  forceHwmReset,
  markInvoiceUncollectible,
  payInvoice,
  refundInvoice,
  retryFailedProration,
  runProrationNow,
  syncSeatsToStripe,
  triggerHwmReconciliation,
  updateSubscriptionQuantity,
  voidInvoice,
} from "./billingDebugActions";
import type {
  ActiveStrategyName,
  HealthCheck,
  HealthStatus,
  SeatBillingDebugData,
} from "./SeatBillingDebugTypes";

// -- Constants --

const STRATEGY_VARIANT: Record<ActiveStrategyName, "success" | "info" | "warning"> = {
  ImmediateUpdate: "success",
  HighWaterMark: "info",
  MonthlyProration: "warning",
};

const STRATEGY_LABELS: Record<ActiveStrategyName, string> = {
  ImmediateUpdate: "Immediate Update",
  HighWaterMark: "High Water Mark",
  MonthlyProration: "Monthly Proration",
};

const STRATEGY_DESCRIPTIONS: Record<ActiveStrategyName, string> = {
  ImmediateUpdate:
    "Stripe is updated immediately when seats change. The customer is charged or credited right away.",
  HighWaterMark:
    "Tracks peak seat count during a billing cycle. At renewal, the customer is charged for peak usage.",
  MonthlyProration:
    "For annual plans. Seat changes are tracked monthly, and on the 1st a prorated invoice is generated.",
};

const HEALTH_VARIANT: Record<HealthStatus, "success" | "warning" | "error"> = {
  ok: "success",
  warn: "warning",
  error: "error",
};

const IS_DEV = process.env.NODE_ENV === "development";

// -- Primitives --

function InfoTip({ content }: { content: string }) {
  return (
    <Tooltip>
      <TooltipTrigger className="text-muted-foreground hover:text-foreground inline-flex cursor-help">
        <InfoIcon className="size-3.5" />
      </TooltipTrigger>
      <TooltipPopup>{content}</TooltipPopup>
    </Tooltip>
  );
}

function Muted({ children }: { children: React.ReactNode }) {
  return <p className="text-muted-foreground text-xs">{children}</p>;
}

function KV({
  label,
  value,
  hint,
  warn,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  warn?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2 py-0.5">
      <span className="text-muted-foreground inline-flex items-center gap-1 text-xs font-medium">
        {label}
        {hint && <InfoTip content={hint} />}
      </span>
      <span className="text-foreground flex items-center gap-1.5 text-xs font-semibold">
        {value ?? "N/A"}
        {warn && (
          <Badge variant="warning" size="sm">
            mismatch
          </Badge>
        )}
      </span>
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

// -- Tab: Overview --

function HealthCheckRow({ check }: { check: HealthCheck }) {
  return (
    <div className="flex items-start gap-2 py-1">
      <Badge variant={HEALTH_VARIANT[check.status]} size="sm" className="mt-0.5 shrink-0">
        {check.status}
      </Badge>
      <div className="min-w-0">
        <span className="text-foreground text-xs font-medium">{check.label}</span>
        <p className="text-muted-foreground text-xs">{check.detail}</p>
      </div>
    </div>
  );
}

function OverviewTab({ data }: { data: SeatBillingDebugData }) {
  return (
    <div className="flex flex-col gap-3">
      {data.errors.length > 0 && (
        <Alert variant="error">
          <AlertTitle>Some data could not be loaded</AlertTitle>
          <AlertDescription>
            <ul className="list-inside list-disc text-xs">
              {data.errors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Health Checks */}
      <Card>
        <CardHeader className="p-3 pb-2">
          <CardTitle className="text-xs font-semibold uppercase tracking-wide">
            Health Checks
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-0">
          <div className="divide-y divide-border">
            {data.healthChecks.map((check, i) => (
              <HealthCheckRow key={i} check={check} />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Strategy */}
      <Card>
        <CardHeader className="p-3 pb-2">
          <CardTitle className="text-xs font-semibold uppercase tracking-wide">
            Billing Strategy
          </CardTitle>
          <CardDescription className="text-xs">{STRATEGY_DESCRIPTIONS[data.activeStrategy]}</CardDescription>
        </CardHeader>
        <CardContent className="p-3 pt-0">
          <div className="mb-2 flex items-center gap-2">
            <Badge variant={STRATEGY_VARIANT[data.activeStrategy]}>
              {STRATEGY_LABELS[data.activeStrategy]}
            </Badge>
            {data.billingPeriod.isOrganization && (
              <Badge variant="outline" size="sm">Org</Badge>
            )}
          </div>
          <KV label="Reason" value={data.strategyReason} />
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge variant={data.featureFlags.hwmSeating ? "success" : "error"} size="sm">
              hwm-seating: {data.featureFlags.hwmSeating ? "ON" : "OFF"}
            </Badge>
            <Badge variant={data.featureFlags.monthlyProration ? "success" : "error"} size="sm">
              monthly-proration: {data.featureFlags.monthlyProration ? "ON" : "OFF"}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Seat Overview */}
      <Card>
        <CardHeader className="p-3 pb-2">
          <CardTitle className="text-xs font-semibold uppercase tracking-wide">
            Seat Overview
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-0">
          <KV label="Current Members" value={data.hwm?.currentMembers ?? "?"} hint="Actual team member count." />
          <KV
            label="Stripe Quantity"
            value={data.stripeSubscription?.quantity ?? "N/A"}
            warn={
              data.hwm !== null &&
              data.stripeSubscription !== null &&
              data.hwm.paidSeats !== null &&
              data.stripeSubscription.quantity !== data.hwm.paidSeats
            }
            hint="What Stripe is billing for."
          />
          <KV label="Paid Seats (DB)" value={data.hwm?.paidSeats ?? "N/A"} hint="Seat count in our database." />
          {data.activeStrategy === "HighWaterMark" && (
            <KV label="High Water Mark" value={data.hwm?.highWaterMark ?? "N/A"} hint="Peak seats this cycle." />
          )}
          <Separator className="my-2" />
          <Muted>This month's changes</Muted>
          <KV label="Added" value={`+${data.seatChanges.additions}`} />
          <KV label="Removed" value={`-${data.seatChanges.removals}`} />
          <KV
            label="Net"
            value={data.seatChanges.netChange > 0 ? `+${data.seatChanges.netChange}` : String(data.seatChanges.netChange)}
          />
        </CardContent>
      </Card>

      {/* Billing Period */}
      <Card>
        <CardHeader className="p-3 pb-2">
          <CardTitle className="text-xs font-semibold uppercase tracking-wide">
            Billing Period
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-0">
          <KV label="Plan type" value={data.billingPeriod.period} hint="MONTHLY uses HWM. ANNUALLY uses proration." />
          <KV label="Subscription started" value={formatDate(data.billingPeriod.subscriptionStart)} />
          <KV label="Subscription ends" value={formatDate(data.billingPeriod.subscriptionEnd)} />
          <KV
            label="Trial"
            value={data.billingPeriod.isInTrial ? `Yes (ends ${formatDate(data.billingPeriod.trialEnd)})` : "No"}
          />
          <KV label="Price per seat" value={formatCents(data.billingPeriod.pricePerSeat)} />
        </CardContent>
      </Card>

      {/* Stripe Subscription */}
      <Card>
        <CardHeader className="p-3 pb-2">
          <CardTitle className="text-xs font-semibold uppercase tracking-wide">
            Stripe Subscription
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-0">
          {data.stripeSubscription ? (
            <>
              <KV label="Status" value={data.stripeSubscription.status} />
              <KV label="Quantity" value={data.stripeSubscription.quantity} />
              <KV label="Period start" value={formatDate(data.stripeSubscription.currentPeriodStart)} />
              <KV label="Period end" value={formatDate(data.stripeSubscription.currentPeriodEnd)} />
              <KV label="Price/seat" value={formatCents(data.stripeSubscription.pricePerSeat)} />
            </>
          ) : (
            <Muted>No Stripe subscription found.</Muted>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// -- Tab: Invoices --

function InvoiceStatusBadge({ status }: { status: string | null }) {
  const variant =
    status === "paid" ? "success"
      : status === "open" ? "info"
      : status === "void" ? "outline"
      : status === "uncollectible" ? "warning"
      : "outline";
  return (
    <Badge variant={variant} size="sm">
      {status ?? "unknown"}
    </Badge>
  );
}

function InvoiceActions({
  invoice,
  onAction,
}: {
  invoice: SeatBillingDebugData["recentInvoices"][number];
  onAction: (action: () => Promise<{ success: boolean; error?: string }>) => void;
}) {
  const canRefund = invoice.status === "paid";
  const canVoid = invoice.status === "open" || invoice.status === "draft" || invoice.status === "uncollectible";
  const canMarkUncollectible = invoice.status === "open";
  const canPay = invoice.status === "open";

  return (
    <div className="flex flex-wrap gap-1">
      {canPay && (
        <Button variant="outline" size="xs" onClick={() => onAction(() => payInvoice(invoice.id))}>
          <CreditCardIcon /> Pay
        </Button>
      )}
      {canRefund && (
        <Button variant="destructive" size="xs" onClick={() => onAction(() => refundInvoice(invoice.id))}>
          Refund
        </Button>
      )}
      {canVoid && (
        <Button variant="outline" size="xs" onClick={() => onAction(() => voidInvoice(invoice.id))}>
          Void
        </Button>
      )}
      {canMarkUncollectible && (
        <Button variant="outline" size="xs" onClick={() => onAction(() => markInvoiceUncollectible(invoice.id))}>
          Mark Uncollectible
        </Button>
      )}
      {invoice.hostedInvoiceUrl && (
        <Button variant="ghost" size="xs" render={<a href={invoice.hostedInvoiceUrl} target="_blank" rel="noreferrer" />}>
          <ExternalLinkIcon /> View
        </Button>
      )}
      {invoice.invoicePdf && (
        <Button variant="ghost" size="xs" render={<a href={invoice.invoicePdf} target="_blank" rel="noreferrer" />}>
          <DownloadIcon /> PDF
        </Button>
      )}
    </div>
  );
}

function InvoicesTab({
  data,
  onAction,
}: {
  data: SeatBillingDebugData;
  onAction: (action: () => Promise<{ success: boolean; error?: string }>) => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-3">
      <Card>
        <CardHeader className="p-3 pb-2">
          <CardTitle className="text-xs font-semibold uppercase tracking-wide">
            Recent Invoices
          </CardTitle>
          <CardDescription className="text-xs">Click to expand for details and actions.</CardDescription>
        </CardHeader>
        <CardContent className="p-3 pt-0">
          {data.recentInvoices.length > 0 ? (
            <div className="divide-y divide-border">
              {data.recentInvoices.map((inv) => {
                const isExpanded = expandedId === inv.id;
                return (
                  <div key={inv.id} className="py-1.5">
                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : inv.id)}
                      className="flex w-full items-center justify-between text-left">
                      <div className="text-xs">
                        <span className="text-muted-foreground">{formatShortDate(inv.created)}</span>
                        <span className="text-foreground ml-2 font-medium">{formatCents(inv.amountDue)}</span>
                        {inv.number && <span className="text-muted-foreground ml-2">#{inv.number}</span>}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <InvoiceStatusBadge status={inv.status} />
                        {inv.paymentMethod?.card && (
                          <span className="text-muted-foreground text-[11px]">
                            {inv.paymentMethod.card.brand} ...{inv.paymentMethod.card.last4}
                          </span>
                        )}
                        {isExpanded ? (
                          <ChevronUpIcon className="text-muted-foreground size-3.5" />
                        ) : (
                          <ChevronDownIcon className="text-muted-foreground size-3.5" />
                        )}
                      </div>
                    </button>
                    {isExpanded && (
                      <div className="mt-1.5 rounded-md border border-border bg-muted/50 p-2">
                        <div className="mb-2 space-y-0.5">
                          <KV label="Invoice ID" value={<span className="font-mono text-[11px]">{inv.id}</span>} />
                          <KV label="Amount due" value={formatCents(inv.amountDue)} />
                          <KV label="Amount paid" value={formatCents(inv.amountPaid)} />
                          {inv.description && <KV label="Description" value={inv.description} />}
                        </div>
                        {inv.lineItems.length > 0 && (
                          <div className="mb-2">
                            <Muted>Line Items</Muted>
                            {inv.lineItems.map((li, i) => (
                              <div key={i} className="text-muted-foreground flex justify-between text-[11px]">
                                <span className="truncate">{li.description ?? "N/A"}</span>
                                <span className="text-foreground shrink-0 font-medium">{formatCents(li.amount)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        <InvoiceActions invoice={inv} onAction={onAction} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <Muted>No invoices found.</Muted>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// -- Tab: Strategy --

function StrategyTab({ data }: { data: SeatBillingDebugData }) {
  const hwmPred = data.predictions.hwm;
  const prorationPred = data.predictions.proration;

  return (
    <div className="flex flex-col gap-3">
      {/* HWM Prediction */}
      {hwmPred && (
        <Card>
          <CardHeader className="p-3 pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wide">
              What happens at renewal
            </CardTitle>
            <CardDescription className="text-xs">
              HWM charges for peak seat count. ~3 days before period end, Stripe qty is set to HWM.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            {hwmPred.pastReconciliationWindow ? (
              <Alert variant="warning">
                <AlertTitle>Inside reconciliation window</AlertTitle>
                <AlertDescription>The invoice.upcoming webhook may have already fired.</AlertDescription>
              </Alert>
            ) : (
              <KV
                label="Reconciliation in"
                value={`${hwmPred.daysUntilReconciliation} days (${formatShortDate(hwmPred.reconciliationDate)})`}
              />
            )}
            <KV
              label="Stripe qty will change"
              value={
                hwmPred.currentStripeQty === hwmPred.expectedStripeQty
                  ? `${hwmPred.currentStripeQty} (no change)`
                  : `${hwmPred.currentStripeQty} -> ${hwmPred.expectedStripeQty}`
              }
            />
            <KV label="Additional seats charged" value={hwmPred.additionalSeatsCharged} />
            <KV label="Expected charge" value={formatCents(hwmPred.expectedCharge)} />
            <KV label="Period ends in" value={`${hwmPred.daysUntilPeriodEnd} days`} />
          </CardContent>
        </Card>
      )}

      {/* Proration Prediction */}
      {prorationPred && (
        <Card>
          <CardHeader className="p-3 pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wide">
              What happens next month
            </CardTitle>
            <CardDescription className="text-xs">
              Proration cron runs on the 1st. Generates prorated invoice based on remaining days.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            {prorationPred.alreadyProcessedThisMonth ? (
              <Alert variant="info">
                <AlertTitle>Already processed</AlertTitle>
                <AlertDescription>Further seat changes will be in next month's run.</AlertDescription>
              </Alert>
            ) : (
              <KV
                label="Cron runs in"
                value={`${prorationPred.daysUntilCronRun} days (${formatShortDate(prorationPred.cronRunDate)})`}
              />
            )}
            <KV
              label="Net seat change"
              value={prorationPred.currentNetIncrease > 0 ? `+${prorationPred.currentNetIncrease}` : String(prorationPred.currentNetIncrease)}
            />
            <KV
              label="Days remaining"
              value={`${prorationPred.daysRemainingInPeriod} of ${prorationPred.totalDaysInPeriod}`}
            />
            <KV label="Estimated invoice" value={formatCents(prorationPred.estimatedAmount)} />
          </CardContent>
        </Card>
      )}

      {/* HWM Record */}
      {data.activeStrategy === "HighWaterMark" && data.hwm && (
        <Card>
          <CardHeader className="p-3 pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wide">HWM Record</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <KV label="High Water Mark" value={data.hwm.highWaterMark} hint="Peak seats this billing cycle." />
            <KV label="Period start" value={formatDate(data.hwm.periodStart)} />
            <KV label="Paid seats (DB)" value={data.hwm.paidSeats} />
          </CardContent>
        </Card>
      )}

      {/* Proration Record */}
      {data.activeStrategy === "MonthlyProration" && (
        <Card>
          <CardHeader className="p-3 pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wide">
              Proration Record
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            {data.proration ? (
              <>
                <KV label="Month" value={data.proration.monthKey} />
                <KV label="Seats start / end" value={`${data.proration.seatsAtStart} -> ${data.proration.seatsAtEnd}`} />
                <KV label="Added / Removed" value={`+${data.proration.seatsAdded} / -${data.proration.seatsRemoved}`} />
                <KV label="Net increase" value={data.proration.netSeatIncrease} />
                <KV label="Prorated amount" value={formatCents(data.proration.proratedAmount)} />
                <KV label="Status" value={data.proration.status} />
                {data.proration.invoiceUrl && (
                  <Button
                    variant="outline"
                    size="xs"
                    className="mt-1.5"
                    render={<a href={data.proration.invoiceUrl} target="_blank" rel="noreferrer" />}>
                    <ExternalLinkIcon /> View Invoice
                  </Button>
                )}
              </>
            ) : (
              <Muted>No proration record for this month yet.</Muted>
            )}
          </CardContent>
        </Card>
      )}

      {!hwmPred && !prorationPred && data.activeStrategy === "ImmediateUpdate" && (
        <Alert variant="info">
          <AlertDescription>
            Immediate Update strategy has no predictions -- Stripe is updated in real-time.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

// -- Tab: Actions --

function ActionsTab({
  data,
  onAction,
  actionResult,
}: {
  data: SeatBillingDebugData;
  onAction: (action: () => Promise<{ success: boolean; error?: string }>) => void;
  actionResult: string | null;
}) {
  const [qtyInput, setQtyInput] = useState("");

  const subscriptionId = data.subscription?.id;
  const subscriptionItemId = data.subscription?.itemId;
  const isTrial = data.billingPeriod.isInTrial;
  const isActive = data.stripeSubscription?.status === "active" || data.stripeSubscription?.status === "trialing";

  return (
    <div className="flex flex-col gap-3">
      {actionResult && (
        <Alert variant={actionResult.startsWith("Error") ? "error" : "success"}>
          <AlertDescription>{actionResult}</AlertDescription>
        </Alert>
      )}

      {/* Subscription Actions */}
      {data.subscription && (
        <Card>
          <CardHeader className="p-3 pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wide">
              Subscription
            </CardTitle>
            <CardDescription className="text-xs">
              Direct Stripe operations. These bypass normal billing flows.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-1.5">
                <Button variant="outline" size="sm" className="flex-1 justify-center" onClick={() => onAction(() => syncSeatsToStripe(data.teamId))}>
                  Sync DB Seats to Stripe
                </Button>
                <InfoTip content="Sets Stripe qty to current member count and updates DB paidSeats." />
              </div>

              {isTrial && subscriptionId && (
                <div className="flex items-center gap-1.5">
                  <Button variant="outline" size="sm" className="flex-1 justify-center" onClick={() => onAction(() => endTrialNow(subscriptionId))}>
                    End Trial Now
                  </Button>
                  <InfoTip content="Immediately converts trial to active." />
                </div>
              )}

              {subscriptionId && subscriptionItemId && (
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={1}
                    placeholder="Qty"
                    value={qtyInput}
                    onChange={(e) => setQtyInput(e.target.value)}
                    className="w-16 rounded-md border border-input bg-background px-2 py-1 text-xs"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 justify-center"
                    disabled={!qtyInput || Number(qtyInput) < 1}
                    onClick={() => {
                      const qty = Number(qtyInput);
                      if (qty >= 1) {
                        onAction(() => updateSubscriptionQuantity(subscriptionId, subscriptionItemId, qty));
                        setQtyInput("");
                      }
                    }}>
                    Set Stripe Quantity
                  </Button>
                  <InfoTip content="Manually set Stripe subscription quantity." />
                </div>
              )}

              {isActive && subscriptionId && (
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="destructive"
                    size="sm"
                    className="flex-1 justify-center"
                    onClick={() => {
                      if (window.confirm("Cancel this subscription? This is immediate.")) {
                        onAction(() => cancelSubscription(subscriptionId));
                      }
                    }}>
                    Cancel Subscription
                  </Button>
                  <InfoTip content="Immediately cancels the Stripe subscription." />
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Strategy Actions */}
      {(data.activeStrategy === "HighWaterMark" || data.activeStrategy === "MonthlyProration") && (
        <Card>
          <CardHeader className="p-3 pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wide">
              Strategy Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="flex flex-col gap-2">
              {data.activeStrategy === "HighWaterMark" && data.subscription && (
                <>
                  <div className="flex items-center gap-1.5">
                    <Button variant="outline" size="sm" className="flex-1 justify-center" onClick={() => onAction(() => forceHwmReset(data.teamId))}>
                      Reset HWM to Current Members
                    </Button>
                    <InfoTip content="Resets the high water mark to current member count." />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button variant="outline" size="sm" className="flex-1 justify-center" onClick={() => onAction(() => triggerHwmReconciliation(data.subscription!.id))}>
                      Trigger HWM Reconciliation
                    </Button>
                    <InfoTip content="Manually runs invoice.upcoming logic: sets Stripe qty to HWM." />
                  </div>
                </>
              )}

              {data.activeStrategy === "MonthlyProration" && (
                <>
                  <div className="flex items-center gap-1.5">
                    <Button variant="outline" size="sm" className="flex-1 justify-center" onClick={() => onAction(() => runProrationNow(data.teamId, data.monthKey))}>
                      Run Proration Now
                    </Button>
                    <InfoTip content="Manually runs the monthly proration for the current month." />
                  </div>
                  {data.proration?.status === "FAILED" && (
                    <div className="flex items-center gap-1.5">
                      <Button variant="outline" size="sm" className="flex-1 justify-center" onClick={() => onAction(() => retryFailedProration(data.proration!.id))}>
                        Retry Failed Proration
                      </Button>
                      <InfoTip content="Voids old invoice and creates a new one." />
                    </div>
                  )}
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Test Clock Controls -- dev only */}
      {IS_DEV && (
        <TestClockCard data={data} onAction={onAction} />
      )}
    </div>
  );
}

function TestClockCard({
  data,
  onAction,
}: {
  data: SeatBillingDebugData;
  onAction: (action: () => Promise<{ success: boolean; error?: string }>) => void;
}) {
  const periodEndUnix = data.stripeSubscription
    ? Math.floor(new Date(data.stripeSubscription.currentPeriodEnd).getTime() / 1000)
    : null;

  return (
    <Card>
      <CardHeader className="p-3 pb-2">
        <CardTitle className="text-xs font-semibold uppercase tracking-wide">
          Test Clock Controls
        </CardTitle>
        <CardDescription className="text-xs">
          Advance the Stripe test clock. Only works with test mode customers.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-3 pt-0">
        {data.testClock && periodEndUnix ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 justify-center"
                onClick={() => onAction(() => advanceToBeforePeriodEnd(data.testClock!.customerId, periodEndUnix, 3))}>
                Advance to 3d before period end
              </Button>
              <InfoTip content="Triggers invoice.upcoming webhook for HWM reconciliation." />
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 justify-center"
                onClick={() => onAction(() => advancePastPeriodEnd(data.testClock!.customerId, periodEndUnix))}>
                Advance past period end
              </Button>
              <InfoTip content="Ends the current billing cycle and starts a new one." />
            </div>
            <div className="flex gap-1.5">
              <input
                type="datetime-local"
                id="custom-advance-time"
                className="rounded-md border border-input bg-background px-2 py-1 text-xs"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const input = document.getElementById("custom-advance-time") as HTMLInputElement;
                  if (input?.value) {
                    const ts = Math.floor(new Date(input.value).getTime() / 1000);
                    onAction(() => advanceTestClock(data.testClock!.customerId, ts));
                  }
                }}>
                Custom
              </Button>
            </div>
          </div>
        ) : (
          <Muted>No customer/subscription or no test clock attached.</Muted>
        )}
      </CardContent>
    </Card>
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

  const handleAction = useCallback(
    async (action: () => Promise<{ success: boolean; error?: string }>) => {
      setActionResult(null);
      const result = await action();
      if (result.success) {
        setActionResult(result.error ?? "Success");
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
        <Button variant="outline" size="sm" className="shadow-lg" onClick={() => setOpen(true)}>
          <CreditCardIcon />
          <span className="font-semibold">Billing Debug</span>
          <Badge variant={STRATEGY_VARIANT[data.activeStrategy]} size="sm" className="ml-1">
            {STRATEGY_LABELS[data.activeStrategy]}
          </Badge>
          {hasIssues && (
            <Badge variant={errorCount > 0 ? "error" : "warning"} size="sm" className="ml-0.5">
              {errorCount > 0 ? `${errorCount} err` : `${warnCount} warn`}
            </Badge>
          )}
        </Button>
      </div>

      {/* Sheet panel */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetPopup side="right" className="max-w-lg">
          <SheetHeader>
            <SheetTitle>Billing Inspector</SheetTitle>
            <SheetDescription>
              Team {data.teamId} -- {STRATEGY_LABELS[data.activeStrategy]} strategy
            </SheetDescription>
          </SheetHeader>

          <SheetPanel>
            <Tabs defaultValue="overview">
              <TabsList variant="default" className="mb-3 w-full">
                <TabsTab value="overview">Overview</TabsTab>
                <TabsTab value="invoices">Invoices</TabsTab>
                <TabsTab value="strategy">Strategy</TabsTab>
                <TabsTab value="actions">Actions</TabsTab>
              </TabsList>

              <TabsPanel value="overview">
                <OverviewTab data={data} />
              </TabsPanel>

              <TabsPanel value="invoices">
                <InvoicesTab data={data} onAction={handleAction} />
              </TabsPanel>

              <TabsPanel value="strategy">
                <StrategyTab data={data} />
              </TabsPanel>

              <TabsPanel value="actions">
                <ActionsTab data={data} onAction={handleAction} actionResult={actionResult} />
              </TabsPanel>
            </Tabs>
          </SheetPanel>

          <SheetFooter>
            <div className="flex w-full items-center justify-between">
              <label className="text-muted-foreground flex items-center gap-1.5 text-xs">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="rounded border-input"
                />
                Auto-refresh (5s)
              </label>
              <Button
                variant="outline"
                size="sm"
                disabled={isPending}
                onClick={() => startTransition(() => router.refresh())}>
                <RefreshCwIcon className={cn(isPending && "animate-spin")} />
                Refresh
              </Button>
            </div>
          </SheetFooter>
        </SheetPopup>
      </Sheet>
    </>
  );
}
