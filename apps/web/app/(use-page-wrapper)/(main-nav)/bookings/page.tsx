import type { PageProps } from "app/_types";
import { redirect } from "next/navigation";

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
  redirect(`/bookings/upcoming${queryString ? `?${queryString}` : ""}`);
};

export default Page;
