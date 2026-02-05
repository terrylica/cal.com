import stripe from "@calcom/features/ee/payments/server/stripe";
import type { Logger } from "@calcom/lib/logger";
import logger from "@calcom/lib/logger";
import { safeStringify } from "@calcom/lib/safeStringify";
import prisma from "@calcom/prisma";
import { BookingStatus } from "@calcom/prisma/enums";
import { z } from "zod";

const log: Logger = logger.getSubLogger({ prefix: ["cancelAbandonedStripePayment"] });

export const cancelAbandonedStripePaymentPayloadSchema = z.object({
  bookingId: z.number(),
  paymentId: z.number(),
});

export async function cancelAbandonedStripePayment(payload: string): Promise<void> {
  try {
    const { bookingId, paymentId } = cancelAbandonedStripePaymentPayloadSchema.parse(JSON.parse(payload));

    log.debug(
      `Processing cancelAbandonedStripePayment task for bookingId ${bookingId}, paymentId ${paymentId}`
    );

    const payment = await prisma.payment.findFirst({
      where: { id: paymentId },
      select: {
        id: true,
        success: true,
        externalId: true,
        app: {
          select: {
            slug: true,
          },
        },
        booking: {
          select: {
            id: true,
            status: true,
            paid: true,
          },
        },
      },
    });

    if (!payment) {
      log.warn(`Payment ${paymentId} not found, skipping cancellation`);
      return;
    }

    if (payment.success || payment.booking?.paid) {
      log.debug(
        `Payment ${paymentId} already succeeded or booking ${bookingId} already paid, skipping cancellation`
      );
      return;
    }

    if (payment.booking?.status !== BookingStatus.PENDING) {
      log.debug(
        `Booking ${bookingId} is not in PENDING status (current: ${payment.booking?.status}), skipping cancellation`
      );
      return;
    }

    if (payment.externalId && payment.app?.slug === "stripe") {
      try {
        const paymentIntent = await stripe.paymentIntents.retrieve(payment.externalId);
        if (paymentIntent.status === "succeeded") {
          log.debug(
            `Stripe PaymentIntent ${payment.externalId} already succeeded, skipping cancellation (webhook may be delayed)`
          );
          return;
        }
      } catch (error) {
        log.warn(
          `Could not verify Stripe PaymentIntent status for ${payment.externalId}, continuing with cancellation`,
          safeStringify(error)
        );
      }
    }

    await prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: BookingStatus.CANCELLED,
        cancellationReason: "Payment not completed within the allowed time",
      },
    });

    log.info(`Booking ${bookingId} cancelled due to abandoned payment`);
  } catch (error) {
    let errorMessage: string;
    if (error instanceof Error) {
      errorMessage = error.message;
    } else {
      errorMessage = String(error);
    }
    log.error(`Failed to cancel abandoned payment booking`, safeStringify({ payload, error: errorMessage }));
    throw error;
  }
}
