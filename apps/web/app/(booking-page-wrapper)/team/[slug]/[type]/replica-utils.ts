import { headers } from "next/headers";

/**
 * Gets the replica name from the x-cal-replica header.
 * Returns null if the header is not present.
 */
export async function getReplicaFromHeaders(): Promise<string | null> {
  return (await headers()).get("x-cal-replica");
}
