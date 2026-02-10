import {
  AvailableSlotsService,
  type IAvailableSlotsService,
} from "@calcom/features/availability/services/AvailableSlotsService";

export { AvailableSlotsService, type IAvailableSlotsService };

export type GetAvailableSlotsResponse = Awaited<
  ReturnType<(typeof AvailableSlotsService)["prototype"]["_getAvailableSlots"]>
>;
