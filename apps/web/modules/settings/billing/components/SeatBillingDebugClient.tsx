"use client";

import process from "node:process";
import classNames from "@calcom/ui/classNames";
import { Badge } from "@calcom/ui/components/badge";
import { Button } from "@calcom/ui/components/button";
import { useState, useTransition } from "react";
import type { SeatBillingDebugData } from "./SeatBillingDebug";
import { advanceToBeforePeriodEnd, advancePastPeriodEnd } from "./advanceTestClockAction";

interface SeatBillingDebugClientProps {
  data: SeatBillingDebugData;
}

function formatDate(isoString: string | null): string {
  if (!isoString) return "N/A";
  return new Date(isoString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatPrice(cents: number | null): string {
  if (cents === null) return "N/A";
  return `$${(cents / 100).toFixed(2)}`;
}

export function SeatBillingDebugClient({ data }: SeatBillingDebugClientProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [clockMessage, setClockMessage] = useState<string | null>(null);

  // Only show in development
  if (process.env.NODE_ENV === "production") {
    return null;
  }

  const handleAdvanceToBeforePeriodEnd = () => {
    if (!data.stripe?.testClockId || !data.stripe?.currentPeriodEnd) return;
    const periodEndTimestamp = Math.floor(new Date(data.stripe.currentPeriodEnd).getTime() / 1000);
    startTransition(async () => {
      setClockMessage(null);
      const result = await advanceToBeforePeriodEnd(data.stripe!.testClockId!, periodEndTimestamp, 3);
      if (result.success) {
        setClockMessage(`Clock advanced to ${result.newFrozenTime} (3 days before period end)`);
      } else {
        setClockMessage(`Error: ${result.error}`);
      }
    });
  };

  const handleAdvancePastPeriodEnd = () => {
    if (!data.stripe?.testClockId || !data.stripe?.currentPeriodEnd) return;
    const periodEndTimestamp = Math.floor(new Date(data.stripe.currentPeriodEnd).getTime() / 1000);
    startTransition(async () => {
      setClockMessage(null);
      const result = await advancePastPeriodEnd(data.stripe!.testClockId!, periodEndTimestamp);
      if (result.success) {
        setClockMessage(`Clock advanced to ${result.newFrozenTime} (past period end - renewal triggered)`);
      } else {
        setClockMessage(`Error: ${result.error}`);
      }
    });
  };

  const hwmMismatch =
    data.billing?.highWaterMark !== null &&
    data.stripe?.quantity !== null &&
    data.billing.highWaterMark !== data.stripe.quantity;

  const memberMismatch = data.stripe?.quantity !== null && data.currentMembers !== data.stripe.quantity;

  return (
    <div className="border-subtle bg-muted mt-6 rounded-lg border">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-subtle text-xs font-mono">DEV</span>
          <span className="text-default text-sm font-medium">Seat Billing Debug</span>
          {(hwmMismatch || memberMismatch) && (
            <Badge variant="orange" size="sm">
              Mismatch
            </Badge>
          )}
        </div>
        <span className="text-subtle text-xs">{isExpanded ? "Hide" : "Show"}</span>
      </button>

      {isExpanded && (
        <div className="border-subtle border-t px-4 py-4">
          {/* Overview Grid */}
          <div className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-4">
            <div className="bg-default rounded-md border border-subtle p-3">
              <div className="text-subtle text-xs">Current Members</div>
              <div className="text-emphasis text-lg font-semibold">{data.currentMembers}</div>
            </div>
            <div className="bg-default rounded-md border border-subtle p-3">
              <div className="text-subtle text-xs">Stripe Qty</div>
              <div
                className={classNames(
                  "text-lg font-semibold",
                  memberMismatch ? "text-orange-500" : "text-emphasis"
                )}>
                {data.stripe?.quantity ?? "N/A"}
              </div>
            </div>
            <div className="bg-default rounded-md border border-subtle p-3">
              <div className="text-subtle text-xs">Paid Seats (DB)</div>
              <div className="text-emphasis text-lg font-semibold">{data.billing?.paidSeats ?? "N/A"}</div>
            </div>
            <div className="bg-default rounded-md border border-subtle p-3">
              <div className="text-subtle text-xs">High Water Mark</div>
              <div
                className={classNames(
                  "text-lg font-semibold",
                  hwmMismatch ? "text-orange-500" : "text-emphasis"
                )}>
                {data.billing?.highWaterMark ?? "N/A"}
              </div>
            </div>
          </div>

          {/* Feature Flags */}
          <div className="mb-4">
            <div className="text-subtle mb-2 text-xs font-medium uppercase">Feature Flags</div>
            <div className="flex gap-2">
              <Badge variant={data.featureFlags.hwmSeating ? "green" : "gray"} size="sm">
                hwm-seating: {data.featureFlags.hwmSeating ? "ON" : "OFF"}
              </Badge>
              <Badge variant={data.featureFlags.monthlyProration ? "green" : "gray"} size="sm">
                monthly-proration: {data.featureFlags.monthlyProration ? "ON" : "OFF"}
              </Badge>
            </div>
          </div>

          {/* Billing Details */}
          <div className="mb-4">
            <div className="text-subtle mb-2 text-xs font-medium uppercase">Billing Details</div>
            <div className="bg-default rounded-md border border-subtle p-3 font-mono text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-subtle">Type:</span>{" "}
                  <span className="text-default">{data.isOrganization ? "Organization" : "Team"}</span>
                </div>
                <div>
                  <span className="text-subtle">Period:</span>{" "}
                  <span className="text-default">{data.billing?.billingPeriod ?? "N/A"}</span>
                </div>
                <div>
                  <span className="text-subtle">Price/Seat:</span>{" "}
                  <span className="text-default">{formatPrice(data.billing?.pricePerSeat ?? null)}</span>
                </div>
                <div>
                  <span className="text-subtle">Subscription ID:</span>{" "}
                  <span className="text-default truncate">
                    {data.billing?.subscriptionId?.slice(0, 20) ?? "N/A"}...
                  </span>
                </div>
                <div>
                  <span className="text-subtle">HWM Period Start:</span>{" "}
                  <span className="text-default">
                    {formatDate(data.billing?.highWaterMarkPeriodStart ?? null)}
                  </span>
                </div>
                <div>
                  <span className="text-subtle">Subscription End:</span>{" "}
                  <span className="text-default">{formatDate(data.billing?.subscriptionEnd ?? null)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Stripe Details */}
          {data.stripe && (
            <div className="mb-4">
              <div className="text-subtle mb-2 text-xs font-medium uppercase">Stripe Subscription</div>
              <div className="bg-default rounded-md border border-subtle p-3 font-mono text-xs">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-subtle">Status:</span>{" "}
                    <Badge variant={data.stripe.status === "active" ? "green" : "orange"} size="sm">
                      {data.stripe.status}
                    </Badge>
                  </div>
                  <div>
                    <span className="text-subtle">Quantity:</span>{" "}
                    <span className="text-default">{data.stripe.quantity}</span>
                  </div>
                  <div>
                    <span className="text-subtle">Period Start:</span>{" "}
                    <span className="text-default">{formatDate(data.stripe.currentPeriodStart)}</span>
                  </div>
                  <div>
                    <span className="text-subtle">Period End:</span>{" "}
                    <span className="text-default">{formatDate(data.stripe.currentPeriodEnd)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Test Clock Controls */}
          {data.stripe?.testClockId && (
            <div className="mb-4">
              <div className="text-subtle mb-2 text-xs font-medium uppercase">Test Clock Controls</div>
              <div className="bg-default rounded-md border border-subtle p-3">
                <div className="mb-3 font-mono text-xs">
                  <div>
                    <span className="text-subtle">Test Clock ID:</span>{" "}
                    <span className="text-default">{data.stripe.testClockId}</span>
                  </div>
                  <div>
                    <span className="text-subtle">Current Frozen Time:</span>{" "}
                    <span className="text-default">{formatDate(data.stripe.testClockFrozenTime)}</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    color="secondary"
                    size="sm"
                    onClick={handleAdvanceToBeforePeriodEnd}
                    disabled={isPending}>
                    {isPending ? "Advancing..." : "Advance to 3 days before period end"}
                  </Button>
                  <Button
                    color="secondary"
                    size="sm"
                    onClick={handleAdvancePastPeriodEnd}
                    disabled={isPending}>
                    {isPending ? "Advancing..." : "Advance past period end (renewal)"}
                  </Button>
                </div>
                {clockMessage && (
                  <div
                    className={classNames(
                      "mt-2 text-xs",
                      clockMessage.startsWith("Error") ? "text-red-500" : "text-green-600"
                    )}>
                    {clockMessage}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Seat Change Logs */}
          <div>
            <div className="text-subtle mb-2 text-xs font-medium uppercase">
              Recent Seat Changes ({data.seatChangeLogs.length})
            </div>
            {data.seatChangeLogs.length === 0 ? (
              <div className="text-subtle text-sm">No seat changes recorded</div>
            ) : (
              <div className="bg-default max-h-48 overflow-y-auto rounded-md border border-subtle">
                <table className="w-full text-xs">
                  <thead className="bg-subtle sticky top-0">
                    <tr>
                      <th className="px-2 py-1 text-left font-medium">Type</th>
                      <th className="px-2 py-1 text-left font-medium">Count</th>
                      <th className="px-2 py-1 text-left font-medium">Month</th>
                      <th className="px-2 py-1 text-left font-medium">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.seatChangeLogs.map((log) => (
                      <tr key={log.id} className="border-subtle border-t">
                        <td className="px-2 py-1">
                          <Badge variant={log.changeType === "ADDITION" ? "green" : "red"} size="sm">
                            {log.changeType === "ADDITION" ? "+" : "-"}
                          </Badge>
                        </td>
                        <td className="px-2 py-1">{log.seatCount}</td>
                        <td className="px-2 py-1 font-mono">{log.monthKey}</td>
                        <td className="px-2 py-1 text-subtle">{formatDate(log.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Stripe Link */}
          {data.billing?.subscriptionId && (
            <div className="mt-4">
              <Button
                color="secondary"
                size="sm"
                href={`https://dashboard.stripe.com/test/subscriptions/${data.billing.subscriptionId}`}
                target="_blank"
                EndIcon="external-link">
                View in Stripe
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
