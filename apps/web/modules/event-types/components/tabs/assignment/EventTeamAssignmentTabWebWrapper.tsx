import {
  EventTeamAssignmentTab,
  type EventTeamAssignmentTabBaseProps,
} from "@calcom/features/eventtypes/components/tabs/assignment/EventTeamAssignmentTab";

import { EditWeightsForAllTeamMembers } from "../../EditWeightsForAllTeamMembers";

const EventTeamAssignmentTabWebWrapper = (
  props: Omit<EventTeamAssignmentTabBaseProps, "isSegmentApplicable" | "EditWeightsForAllTeamMembersComponent">
) => {
  const isSegmentApplicable = !!props.orgId;
  return (
    <EventTeamAssignmentTab
      {...props}
      isSegmentApplicable={isSegmentApplicable}
      EditWeightsForAllTeamMembersComponent={EditWeightsForAllTeamMembers}
    />
  );
};

export default EventTeamAssignmentTabWebWrapper;
