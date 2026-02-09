import type { BillingPeriodInfo } from "../billingPeriod/BillingPeriodService";
import type { IBillingProviderService } from "../billingProvider/IBillingProviderService";
import type { ISeatBillingStrategy, SeatChangeContext } from "./ISeatBillingStrategy";

export class ImmediateUpdateStrategy implements ISeatBillingStrategy {
  constructor(private readonly billingProviderService: IBillingProviderService) {}

  async canHandle(_info: BillingPeriodInfo): Promise<boolean> {
    return true;
  }

  async onSeatChange(context: SeatChangeContext): Promise<void> {
    await this.billingProviderService.handleSubscriptionUpdate({
      subscriptionId: context.subscriptionId,
      subscriptionItemId: context.subscriptionItemId,
      membershipCount: context.membershipCount,
    });
  }
}
