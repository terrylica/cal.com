import { HttpError } from "@calcom/lib/http-error";
import logger from "@calcom/lib/logger";
import { safeStringify } from "@calcom/lib/safeStringify";

import type { VercelConfigResponse, VercelDomainResponse } from "./types";

const log = logger.getSubLogger({ prefix: ["CustomDomains/VercelAPI"] });

function getVercelEnvVars() {
  const projectId = process.env.PROJECT_ID_VERCEL;
  const teamId = process.env.TEAM_ID_VERCEL;
  const authToken = process.env.AUTH_BEARER_TOKEN_VERCEL;

  if (!projectId) {
    throw new HttpError({ statusCode: 500, message: "Missing env var: PROJECT_ID_VERCEL" });
  }

  if (!authToken) {
    throw new HttpError({ statusCode: 500, message: "Missing env var: AUTH_BEARER_TOKEN_VERCEL" });
  }

  return { projectId, teamId, authToken };
}

function getHeaders(authToken: string) {
  return {
    Authorization: `Bearer ${authToken}`,
    "Content-Type": "application/json",
  };
}

function buildUrl(path: string, teamId?: string) {
  const url = new URL(path, "https://api.vercel.com");
  if (teamId) {
    url.searchParams.set("teamId", teamId);
  }
  return url.toString();
}

export async function addDomainToVercel(domain: string): Promise<VercelDomainResponse> {
  const { projectId, teamId, authToken } = getVercelEnvVars();
  const normalizedDomain = domain.toLowerCase();

  log.info(`Adding domain to Vercel: ${normalizedDomain}`);

  const response = await fetch(buildUrl(`/v10/projects/${projectId}/domains`, teamId), {
    method: "POST",
    headers: getHeaders(authToken),
    body: JSON.stringify({ name: normalizedDomain }),
  });

  const data = (await response.json()) as VercelDomainResponse;

  if (data.error) {
    log.error(safeStringify({ message: "Failed to add domain to Vercel", domain: normalizedDomain, error: data.error }));

    if (data.error.code === "forbidden") {
      throw new HttpError({
        statusCode: 403,
        message: "Permission denied. Please verify your Vercel project and team permissions.",
      });
    }

    if (data.error.code === "domain_taken") {
      throw new HttpError({
        statusCode: 409,
        message: "This domain is already in use by another Vercel project.",
      });
    }

    if (data.error.code === "domain_already_in_use") {
      log.info(`Domain ${normalizedDomain} already exists in project, treating as success`);
      return data;
    }

    throw new HttpError({
      statusCode: 400,
      message: data.error.message || "Failed to add domain to Vercel",
    });
  }

  log.info(`Successfully added domain to Vercel: ${normalizedDomain}`);
  return data;
}

export async function getDomainFromVercel(domain: string): Promise<VercelDomainResponse> {
  const { projectId, teamId, authToken } = getVercelEnvVars();
  const normalizedDomain = domain.toLowerCase();

  const response = await fetch(
    buildUrl(`/v9/projects/${projectId}/domains/${normalizedDomain}`, teamId),
    {
      method: "GET",
      headers: getHeaders(authToken),
    }
  );

  return (await response.json()) as VercelDomainResponse;
}

export async function getConfigFromVercel(domain: string): Promise<VercelConfigResponse> {
  const { teamId, authToken } = getVercelEnvVars();
  const normalizedDomain = domain.toLowerCase();

  const response = await fetch(buildUrl(`/v6/domains/${normalizedDomain}/config`, teamId), {
    method: "GET",
    headers: getHeaders(authToken),
  });

  return (await response.json()) as VercelConfigResponse;
}

export async function verifyDomainOnVercel(domain: string): Promise<VercelDomainResponse> {
  const { projectId, teamId, authToken } = getVercelEnvVars();
  const normalizedDomain = domain.toLowerCase();

  log.info(`Verifying domain on Vercel: ${normalizedDomain}`);

  const response = await fetch(
    buildUrl(`/v9/projects/${projectId}/domains/${normalizedDomain}/verify`, teamId),
    {
      method: "POST",
      headers: getHeaders(authToken),
    }
  );

  const data = (await response.json()) as VercelDomainResponse;

  if (data.verified) {
    log.info(`Domain verified successfully: ${normalizedDomain}`);
  } else {
    log.info(`Domain not yet verified: ${normalizedDomain}`);
  }

  return data;
}

export async function removeDomainFromVercel(domain: string): Promise<boolean> {
  const { projectId, teamId, authToken } = getVercelEnvVars();
  const normalizedDomain = domain.toLowerCase();

  log.info(`Removing domain from Vercel: ${normalizedDomain}`);

  const response = await fetch(
    buildUrl(`/v9/projects/${projectId}/domains/${normalizedDomain}`, teamId),
    {
      method: "DELETE",
      headers: getHeaders(authToken),
    }
  );

  const data = (await response.json()) as { error?: { code: string; message: string } };

  if (data.error) {
    if (data.error.code === "not_found") {
      log.info(`Domain ${normalizedDomain} not found on Vercel, treating as already deleted`);
      return true;
    }

    if (data.error.code === "forbidden") {
      throw new HttpError({
        statusCode: 403,
        message: "Permission denied. Please verify your Vercel project and team permissions.",
      });
    }

    log.error(
      safeStringify({ message: "Failed to remove domain from Vercel", domain: normalizedDomain, error: data.error })
    );
    throw new HttpError({
      statusCode: 400,
      message: data.error.message || "Failed to remove domain from Vercel",
    });
  }

  log.info(`Successfully removed domain from Vercel: ${normalizedDomain}`);
  return true;
}
