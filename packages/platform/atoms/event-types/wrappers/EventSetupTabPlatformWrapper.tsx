import React from "react";

import {
  EventSetupTab,
  type EventSetupTabBaseProps,
} from "@calcom/features/eventtypes/components/tabs/setup";

const EventSetupTabPlatformWrapper = (props: EventSetupTabBaseProps) => {
  return (
    <EventSetupTab
      {...props}
      urlPrefix=""
      hasOrgBranding={false}
      slots={{
        Locations: null,
        HostLocations: null,
      }}
    />
  );
};

export default EventSetupTabPlatformWrapper;
