import { post } from "@calcom/lib/fetch-wrapper";
import type { BookingCreateBody, BookingResponse } from "../types";
import { fetchCsrfToken } from "./fetchCsrfToken";

export const createBooking = async (data: BookingCreateBody) => {
  const csrfToken = await fetchCsrfToken();
  const response = await post<
    BookingCreateBody & { csrfToken: string },
    Omit<BookingResponse, "startTime" | "endTime"> & {
      startTime: string;
      endTime: string;
    }
  >("/api/book/event", { ...data, csrfToken });
  return response;
};
