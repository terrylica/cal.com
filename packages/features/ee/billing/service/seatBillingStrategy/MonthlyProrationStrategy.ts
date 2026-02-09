import type { IFeaturesRepository } from "@calcom/features/flags/features.repository.interface";
import logger from "@calcom/lib/logger";

import { findMonthlyProrationLineItem } from "../../lib/proration-utils";
import type { BillingPeriodInfo } from "../billingPeriod/BillingPeriodService";
import type { MonthlyProrationService } from "../proration/MonthlyProrationService";
import { BaseSeatBillingStrategy } from "./ISeatBillingStrategy";
import type { SeatChangeContext, StripeInvoiceData } from "./ISeatBillingStrategy";

const log = logger.getSubLogger({ prefix: ["MonthlyProrationStrategy"] });

export interface IMonthlyProrationStrategyDeps {
  featuresRepository: IFeaturesRepository;
  monthlyProrationService: MonthlyProrationService;
}

export class MonthlyProrationStrategy extends BaseSeatBillingStrategy {
  constructor(private readonly deps: IMonthlyProrationStrategyDeps) {
    super();
  }

  async canHandle(info: BillingPeriodInfo): Promise<boolean> {
    if (info.isInTrial || !info.subscriptionStart) return false;
    if (info.billingPeriod !== "ANNUALLY") return false;
    return this.deps.featuresRepository.checkIfFeatureIsEnabledGlobally("monthly-proration");
  }

  async onSeatChange(_context: SeatChangeContext): Promise<void> {
    // No immediate Stripe update -- proration is calculated and invoiced on a monthly cycle
  }

  override async onPaymentSucceeded(invoice: StripeInvoiceData): Promise<{ handled: boolean }> {
    const prorationLineItem = findMonthlyProrationLineItem(invoice.lines.data);
    if (!prorationLineItem) return { handled: false };

    const prorationId = prorationLineItem.metadata?.prorationId;
    if (!prorationId) {
      log.warn("proration line item missing prorationId metadata");
      return { handled: false };
    }

    await this.deps.monthlyProrationService.handleProrationPaymentSuccess(prorationId);
    log.info(`proration ${prorationId} marked as charged`);
    return { handled: true };
  }

  override async onPaymentFailed(invoice: StripeInvoiceData, reason: string): Promise<{ handled: boolean }> {
    const prorationLineItem = findMonthlyProrationLineItem(invoice.lines.data);
    if (!prorationLineItem) return { handled: false };

    const prorationId = prorationLineItem.metadata?.prorationId;
    if (!prorationId) {
      log.warn("proration line item missing prorationId metadata");
      return { handled: false };
    }

    await this.deps.monthlyProrationService.handleProrationPaymentFailure({
      prorationId,
      reason,
    });
    log.info(`proration ${prorationId} marked as failed`);
    return { handled: true };
  }
}
