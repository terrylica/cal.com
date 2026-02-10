import {
  EventAdvancedTab,
  type EventAdvancedBaseProps,
} from "@calcom/features/eventtypes/components/tabs/advanced/EventAdvancedTab";

import { useConnectedCalendars } from "../../hooks/useConnectedCalendars";
import { useGetVerifiedEmails } from "../hooks/useGetVerifiedEmails";

const EventAdvancedPlatformWrapper = (props: EventAdvancedBaseProps) => {
  const {
    isPending,
    data: connectedCalendarsQuery,
    error,
  } = useConnectedCalendars({});
  const { data: verifiedEmails } = useGetVerifiedEmails(props.team?.id);

  return (
    <EventAdvancedTab
      {...props}
      calendarsQuery={{ data: connectedCalendarsQuery, isPending, error }}
      showBookerLayoutSelector={false}
      verifiedEmails={verifiedEmails}
      isPlatform={true}
      slots={{
        SelectedCalendarsSettings: null,
        SelectedCalendarsSettingsSkeleton: null,
        TimezoneSelect: null,
        MultiplePrivateLinksController: null,
        AddVerifiedEmail: null,
        BookerLayoutSelector: null,
      }}
    />
  );
};

export default EventAdvancedPlatformWrapper;
