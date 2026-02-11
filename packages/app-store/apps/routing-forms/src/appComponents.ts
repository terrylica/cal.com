import dynamic from "next/dynamic";

export const routingFormAppComponents = {
  salesforce: dynamic(() => import("@calcom/salesforce/components/RoutingFormOptions")),
};
