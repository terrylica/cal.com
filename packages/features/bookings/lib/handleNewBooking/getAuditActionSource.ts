import { CreationSource } from "@calcom/prisma/enums";
import type { ValidActionSource } from "@calcom/features/booking-audit/lib/types/actionSource";
import { criticalLogger } from "@calcom/lib/logger.server";

export const getAuditActionSource = ({ creationSource, eventTypeId, rescheduleUid }: { creationSource: CreationSource | null | undefined, eventTypeId: number, rescheduleUid: string | null }): ValidActionSource => {
    if (creationSource === CreationSource.API_V1 || creationSource === CreationSource.API_V2 || creationSource === CreationSource.WEBAPP) {
        return creationSource;
    }
    criticalLogger.warn("Unknown booking creationSource detected", {
        eventTypeId,
        rescheduleUid,
    });
    return "SYSTEM";
};
