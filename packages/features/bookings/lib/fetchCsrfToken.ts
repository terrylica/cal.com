import { get } from "@calcom/lib/fetch-wrapper";

export async function fetchCsrfToken(): Promise<string> {
  const { csrfToken } = await get<{ csrfToken: string }>("/api/csrf");
  return csrfToken;
}
