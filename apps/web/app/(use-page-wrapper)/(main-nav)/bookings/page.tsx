import { prisma } from "@calcom/prisma";
import type { PageProps } from "app/_types";
import { redirect } from "next/navigation";
import { getBookingTabStatus } from "~/bookings/lib/getBookingTabStatus";

const Page = async ({ searchParams }: PageProps) => {
  const params = await searchParams;
  const urlSearchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      for (const v of value) {
        urlSearchParams.append(key, v);
      }
    } else if (value !== undefined) {
      urlSearchParams.append(key, value);
    }
  }
  const queryString = urlSearchParams.toString();

  // Check if uid parameter exists to determine the correct tab
  const uid = params?.uid as string | undefined;
  if (uid && typeof uid === "string") {
    // Fetch booking to determine its correct tab
    const booking = await prisma.booking.findUnique({
      where: { uid },
      select: {
        status: true,
        endTime: true,
        recurringEventId: true,
      },
    });

    if (booking) {
      const correctTab = getBookingTabStatus(booking);

      console.log("correctTab", correctTab);
      redirect(`/bookings/${correctTab}${queryString ? `?${queryString}` : ""}`);
    }
  }

  // Default redirect to upcoming if no uid or booking not found
  redirect(`/bookings/upcoming${queryString ? `?${queryString}` : ""}`);
};

export default Page;
