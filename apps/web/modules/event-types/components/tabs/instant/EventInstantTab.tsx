import { getPaymentAppData } from "@calcom/app-store/_utils/payments/getPaymentAppData";
import { eventTypeMetaDataSchemaWithTypedApps } from "@calcom/app-store/zod-utils";
import type { EventTypeSetupProps } from "@calcom/features/eventtypes/lib/types";
import { UpgradeBannerForInstantBooking } from "@calcom/web/modules/billing/upgrade-banners/fullscreen/forOrgPlan";
import InstantEventController from "./InstantEventController";

export const EventInstantTab = ({
  eventType,
  isTeamEvent,
  belongsToOrg,
}: Pick<EventTypeSetupProps, "eventType"> & { isTeamEvent: boolean; belongsToOrg: boolean }) => {
  if (!belongsToOrg) {
    return <UpgradeBannerForInstantBooking />;
  }

  const paymentAppData = getPaymentAppData({
    ...eventType,
    metadata: eventTypeMetaDataSchemaWithTypedApps.parse(eventType.metadata),
  });

  const requirePayment = paymentAppData.price > 0;

  return (
    <InstantEventController paymentEnabled={requirePayment} eventType={eventType} isTeamEvent={isTeamEvent} />
  );
};
