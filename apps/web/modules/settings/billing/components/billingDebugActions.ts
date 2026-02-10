"use server";

import process from "node:process";
import { getServerSession } from "@calcom/features/auth/lib/getServerSession";
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
