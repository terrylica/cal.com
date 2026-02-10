"use server";

import process from "node:process";
import { getServerSession } from "@calcom/features/auth/lib/getServerSession";
import { getBillingProviderService } from "@calcom/features/ee/billing/di/containers/Billing";
import { HighWaterMarkRepository } from "@calcom/features/ee/billing/repository/highWaterMark/HighWaterMarkRepository";
import { MonthlyProrationRepository } from "@calcom/features/ee/billing/repository/proration/MonthlyProrationRepository";
import { MonthlyProrationTeamRepository } from "@calcom/features/ee/billing/repository/proration/MonthlyProrationTeamRepository";
import { HighWaterMarkService } from "@calcom/features/ee/billing/service/highWaterMark/HighWaterMarkService";
import { MonthlyProrationService } from "@calcom/features/ee/billing/service/proration/MonthlyProrationService";
import stripe from "@calcom/features/ee/payments/server/stripe";
import { UserPermissionRole } from "@calcom/prisma/enums";
import { buildLegacyRequest } from "@lib/buildLegacyCtx";
import { cookies, headers } from "next/headers";

type ActionResult = { success: boolean; error?: string };

async function assertCanAccessDebug() {
  if (process.env.NODE_ENV === "development") return;

  const session = await getServerSession({ req: buildLegacyRequest(await headers(), await cookies()) });
  const isInstanceAdmin = session?.user?.role === UserPermissionRole.ADMIN;
  const isImpersonatedByAdmin = session?.user?.impersonatedBy?.role === UserPermissionRole.ADMIN;

  if (!isInstanceAdmin && !isImpersonatedByAdmin) {
    throw new Error("Billing debug actions require instance admin access");
  }
}

// -- Invoice Actions --

export async function refundInvoice(invoiceId: string): Promise<ActionResult> {
  await assertCanAccessDebug();
  try {
    const invoice = await stripe.invoices.retrieve(invoiceId);
    if (invoice.status !== "paid") {
      return { success: false, error: `Cannot refund invoice with status "${invoice.status}"` };
    }
    if (!invoice.charge) {
      return { success: false, error: "No charge found on this invoice" };
    }
    const chargeId = typeof invoice.charge === "string" ? invoice.charge : invoice.charge.id;
    await stripe.refunds.create({ charge: chargeId });
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function voidInvoice(invoiceId: string): Promise<ActionResult> {
  await assertCanAccessDebug();
  try {
    const invoice = await stripe.invoices.retrieve(invoiceId);
    if (invoice.status === "void") {
      return { success: false, error: "Invoice is already void" };
    }
    if (invoice.status === "draft") {
      await stripe.invoices.del(invoiceId);
      return { success: true };
    }
    if (invoice.status === "open" || invoice.status === "uncollectible") {
      await stripe.invoices.voidInvoice(invoiceId);
      return { success: true };
    }
    return { success: false, error: `Cannot void invoice with status "${invoice.status}"` };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function markInvoiceUncollectible(invoiceId: string): Promise<ActionResult> {
  await assertCanAccessDebug();
  try {
    const invoice = await stripe.invoices.retrieve(invoiceId);
    if (invoice.status !== "open") {
      return { success: false, error: `Cannot mark as uncollectible - status is "${invoice.status}"` };
    }
    await stripe.invoices.markUncollectible(invoiceId);
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function payInvoice(invoiceId: string): Promise<ActionResult> {
  await assertCanAccessDebug();
  try {
    const invoice = await stripe.invoices.retrieve(invoiceId);
    if (invoice.status !== "open") {
      return { success: false, error: `Cannot pay invoice with status "${invoice.status}"` };
    }
    await stripe.invoices.pay(invoiceId);
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// -- Subscription Actions --

export async function cancelSubscription(subscriptionId: string): Promise<ActionResult> {
  await assertCanAccessDebug();
  try {
    await stripe.subscriptions.cancel(subscriptionId);
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function endTrialNow(subscriptionId: string): Promise<ActionResult> {
  await assertCanAccessDebug();
  try {
    const billingService = getBillingProviderService();
    await billingService.handleEndTrial(subscriptionId);
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function updateSubscriptionQuantity(
  subscriptionId: string,
  subscriptionItemId: string,
  quantity: number
): Promise<ActionResult> {
  await assertCanAccessDebug();
  try {
    const billingService = getBillingProviderService();
    await billingService.handleSubscriptionUpdate({
      subscriptionId,
      subscriptionItemId,
      membershipCount: quantity,
      prorationBehavior: "none",
    });
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function syncSeatsToStripe(teamId: number): Promise<ActionResult> {
  await assertCanAccessDebug();
  try {
    const teamRepo = new MonthlyProrationTeamRepository();
    const teamWithBilling = await teamRepo.getTeamWithBilling(teamId);
    if (!teamWithBilling?.billing) {
      return { success: false, error: "No billing record found for team" };
    }
    if (!teamWithBilling.billing.subscriptionItemId) {
      return { success: false, error: "No subscription item ID found" };
    }
    const billingService = getBillingProviderService();
    await billingService.handleSubscriptionUpdate({
      subscriptionId: teamWithBilling.billing.subscriptionId,
      subscriptionItemId: teamWithBilling.billing.subscriptionItemId,
      membershipCount: teamWithBilling.memberCount,
      prorationBehavior: "none",
    });

    await teamRepo.updatePaidSeats(
      teamId,
      teamWithBilling.isOrganization,
      teamWithBilling.billing.id,
      teamWithBilling.memberCount
    );

    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// -- HWM Actions --

export async function forceHwmReset(teamId: number): Promise<ActionResult> {
  await assertCanAccessDebug();
  try {
    const hwmRepo = new HighWaterMarkRepository();
    const hwmData = await hwmRepo.getByTeamId(teamId);
    if (!hwmData) {
      return { success: false, error: "No HWM billing record found for team" };
    }
    const teamRepo = new MonthlyProrationTeamRepository();
    const memberCount = await teamRepo.getTeamMemberCount(teamId);
    if (memberCount === null) {
      return { success: false, error: "Could not get member count" };
    }
    await hwmRepo.reset({
      teamId,
      isOrganization: hwmData.isOrganization,
      currentSeatCount: memberCount,
      newPeriodStart: new Date(),
    });
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function triggerHwmReconciliation(subscriptionId: string): Promise<ActionResult> {
  await assertCanAccessDebug();
  try {
    const billingService = getBillingProviderService();
    const hwmService = new HighWaterMarkService({ billingService });
    const applied = await hwmService.applyHighWaterMarkToSubscription(subscriptionId);
    return { success: true, error: applied ? undefined : "No update needed (HWM matches current quantity)" };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// -- Proration Actions --

export async function retryFailedProration(prorationId: string): Promise<ActionResult> {
  await assertCanAccessDebug();
  try {
    const prorationService = new MonthlyProrationService();
    await prorationService.retryFailedProration(prorationId);
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function runProrationNow(teamId: number, monthKey: string): Promise<ActionResult> {
  await assertCanAccessDebug();
  try {
    const prorationRepo = new MonthlyProrationRepository();
    const existing = await prorationRepo.findByTeamAndMonth(teamId, monthKey);
    if (existing) {
      return { success: false, error: `Proration already exists for ${monthKey} (status: ${existing.status})` };
    }
    const prorationService = new MonthlyProrationService();
    const result = await prorationService.createProrationForTeam({ teamId, monthKey });
    if (!result) {
      return { success: true, error: "No seat changes to process" };
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}
