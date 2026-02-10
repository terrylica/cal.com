import {
  AvailableSlotsService,
  type IAvailableSlotsService,
} from "@calcom/features/availability/services/AvailableSlotsService";
import type { TGetScheduleInputSchema } from "./getSchedule.schema";
import type { GetScheduleOptions } from "./types";

export { AvailableSlotsService, type IAvailableSlotsService };

export type GetAvailableSlotsResponse = Awaited<
  ReturnType<(typeof AvailableSlotsService)["prototype"]["_getAvailableSlots"]>
>;
