/**
 * Out of Office (OOO) functions for Cal.com API
 *
 * NOTE: API v2 currently only has organization-scoped OOO endpoints:
 * - GET /v2/organizations/:orgId/users/:userId/ooo
 * - POST /v2/organizations/:orgId/users/:userId/ooo
 * - PATCH /v2/organizations/:orgId/users/:userId/ooo/:oooId
 * - DELETE /v2/organizations/:orgId/users/:userId/ooo/:oooId
 *
 * These require ORG_ADMIN role and are not suitable for individual user access.
 *
 * Missing user-level API v2 endpoints needed for full functionality:
 * - GET /v2/me/out-of-office - List current user's OOO entries
 * - POST /v2/me/out-of-office - Create OOO entry for current user
 * - PATCH /v2/me/out-of-office/:id - Update current user's OOO entry
 * - DELETE /v2/me/out-of-office/:id - Delete current user's OOO entry
 * - GET /v2/out-of-office/reasons - List available OOO reasons
 */

import type {
  CreateOutOfOfficeEntryInput,
  GetOutOfOfficeEntriesResponse,
  GetOutOfOfficeEntryResponse,
  OutOfOfficeEntry,
  UpdateOutOfOfficeEntryInput,
} from "../types/ooo.types";

import { makeRequest } from "./request";

/**
 * Get all OOO entries for the current user
 * NOTE: This endpoint does not exist in API v2 yet.
 * Currently returns empty array as placeholder.
 */
export async function getOutOfOfficeEntries(filters?: {
  skip?: number;
  take?: number;
  sortStart?: "asc" | "desc";
  sortEnd?: "asc" | "desc";
}): Promise<OutOfOfficeEntry[]> {
  const params = new URLSearchParams();

  if (filters?.skip !== undefined) {
    params.append("skip", filters.skip.toString());
  }
  if (filters?.take !== undefined) {
    params.append("take", filters.take.toString());
  }
  if (filters?.sortStart) {
    params.append("sortStart", filters.sortStart);
  }
  if (filters?.sortEnd) {
    params.append("sortEnd", filters.sortEnd);
  }

  const queryString = params.toString();
  const endpoint = `/me/out-of-office${queryString ? `?${queryString}` : ""}`;

  try {
    const response = await makeRequest<GetOutOfOfficeEntriesResponse>(endpoint, {
      headers: {
        "cal-api-version": "2024-08-13",
      },
    });

    if (response?.data) {
      return response.data;
    }

    return [];
  } catch (error) {
    // API endpoint doesn't exist yet - return empty array
    if (error instanceof Error && error.message.includes("404")) {
      console.warn("OOO endpoint not available - user-level API v2 endpoints needed");
      return [];
    }
    throw error;
  }
}

/**
 * Create an OOO entry for the current user
 * NOTE: This endpoint does not exist in API v2 yet.
 */
export async function createOutOfOfficeEntry(
  input: CreateOutOfOfficeEntryInput
): Promise<OutOfOfficeEntry> {
  const response = await makeRequest<GetOutOfOfficeEntryResponse>(
    "/me/out-of-office",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "cal-api-version": "2024-08-13",
      },
      body: JSON.stringify(input),
    },
    "2024-08-13"
  );

  if (response?.data) {
    return response.data;
  }

  throw new Error("Invalid response from create OOO API");
}

/**
 * Update an OOO entry for the current user
 * NOTE: This endpoint does not exist in API v2 yet.
 */
export async function updateOutOfOfficeEntry(
  oooId: number,
  input: UpdateOutOfOfficeEntryInput
): Promise<OutOfOfficeEntry> {
  const response = await makeRequest<GetOutOfOfficeEntryResponse>(
    `/me/out-of-office/${oooId}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "cal-api-version": "2024-08-13",
      },
      body: JSON.stringify(input),
    },
    "2024-08-13"
  );

  if (response?.data) {
    return response.data;
  }

  throw new Error("Invalid response from update OOO API");
}

/**
 * Delete an OOO entry for the current user
 * NOTE: This endpoint does not exist in API v2 yet.
 */
export async function deleteOutOfOfficeEntry(oooId: number): Promise<OutOfOfficeEntry> {
  const response = await makeRequest<GetOutOfOfficeEntryResponse>(
    `/me/out-of-office/${oooId}`,
    {
      method: "DELETE",
      headers: {
        "cal-api-version": "2024-08-13",
      },
    },
    "2024-08-13"
  );

  if (response?.data) {
    return response.data;
  }

  throw new Error("Invalid response from delete OOO API");
}
