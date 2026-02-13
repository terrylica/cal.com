import { post } from "@calcom/lib/fetch-wrapper";
import type { BookingResponse, RecurringBookingCreateBody } from "../types";
import { fetchCsrfToken } from "./fetchCsrfToken";

type RecurringBookingCreateBodyWithCsrf = RecurringBookingCreateBody & { csrfToken: string };

export const createRecurringBooking = async (data: RecurringBookingCreateBody[]) => {
  const csrfToken = await fetchCsrfToken();
  const dataWithCsrf: RecurringBookingCreateBodyWithCsrf[] = data.map((item) => ({ ...item, csrfToken }));
  const response = await post<
    RecurringBookingCreateBodyWithCsrf[],
    (Omit<BookingResponse, "startTime" | "endTime"> & {
      startTime: string;
      endTime: string;
    })[]
  >("/api/book/recurring-event", dataWithCsrf);
  return response;
};
