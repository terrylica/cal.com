import process from "node:process";
import { HttpError } from "@calcom/lib/http-error";
import { safeStringify } from "@calcom/lib/safeStringify";
import z from "zod";
import logger from "../../logger";

const log = logger.getSubLogger({ prefix: ["Vercel/DomainManager"] });

const vercelDomainApiResponseSchema = z.object({
  error: z
    .object({
      code: z.string().nullish(),
      domain: z.any().nullish(),
      message: z.string().nullish(),
      invalidToken: z.boolean().nullish(),
    })
    .optional(),
});

export interface VercelDomainResponse {
  name: string;
  apexName: string;
  verified: boolean;
  verification?: Array<{
    type: string;
    domain: string;
    value: string;
    reason: string;
  }>;
  error?: {
    code: string;
    message: string;
  };
}

export interface VercelConfigResponse {
  misconfigured: boolean;
  conflicts?: Array<{
    name: string;
    type: string;
    value: string;
  }>;
  error?: {
    code: string;
    message: string;
  };
}

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

export const createDomain = async (domain: string) => {
  const { projectId, teamId, authToken } = getVercelEnvVars();
  const normalizedDomain = domain.toLowerCase();
  log.info(`Creating domain in Vercel: ${normalizedDomain}`);

  const response = await fetch(buildUrl(`/v10/projects/${projectId}/domains`, teamId), {
    body: JSON.stringify({ name: normalizedDomain }),
    headers: getHeaders(authToken),
    method: "POST",
  });

  const responseJson = await response.json();
  const parsedResponse = vercelDomainApiResponseSchema.safeParse(responseJson);

  if (!parsedResponse.success) {
    log.error(
      safeStringify({
        errorMessage: "Failed to parse Vercel domain creation response",
        zodError: parsedResponse.error,
        response: responseJson,
      })
    );
    return false;
  }

  if (!parsedResponse.data.error) {
    return true;
  }

  return handleDomainCreationError(parsedResponse.data.error);
};

export const deleteDomain = async (domain: string) => {
  const { projectId, teamId, authToken } = getVercelEnvVars();
  const normalizedDomain = domain.toLowerCase();
  log.info(`Deleting domain in Vercel: ${normalizedDomain}`);

  const response = await fetch(buildUrl(`/v9/projects/${projectId}/domains/${normalizedDomain}`, teamId), {
    headers: { Authorization: `Bearer ${authToken}` },
    method: "DELETE",
  });

  const data = vercelDomainApiResponseSchema.parse(await response.json());
  if (!data.error) {
    return true;
  }

  return handleDomainDeletionError(data.error);
};

export async function getDomain(domain: string): Promise<VercelDomainResponse> {
  const { projectId, teamId, authToken } = getVercelEnvVars();
  const normalizedDomain = domain.toLowerCase();

  const response = await fetch(buildUrl(`/v9/projects/${projectId}/domains/${normalizedDomain}`, teamId), {
    method: "GET",
    headers: getHeaders(authToken),
  });

  return (await response.json()) as VercelDomainResponse;
}

export async function getConfig(domain: string): Promise<VercelConfigResponse> {
  const { teamId, authToken } = getVercelEnvVars();
  const normalizedDomain = domain.toLowerCase();

  const response = await fetch(buildUrl(`/v6/domains/${normalizedDomain}/config`, teamId), {
    method: "GET",
    headers: getHeaders(authToken),
  });

  return (await response.json()) as VercelConfigResponse;
}

export async function verifyDomain(domain: string): Promise<VercelDomainResponse> {
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

function handleDomainCreationError(error: {
  code?: string | null;
  domain?: string | null;
  message?: string | null;
  invalidToken?: boolean | null;
}) {
  // Vercel returns "forbidden" for various permission issues, not just domain ownership
  if (error.code === "forbidden") {
    const errorMessage =
      "Vercel denied permission to manage this domain. Please verify your Vercel project, team, and domain permissions.";
    log.error(
      safeStringify({
        errorMessage,
        vercelError: error,
      })
    );
    throw new HttpError({
      message: errorMessage,
      statusCode: 400,
    });
  }

  if (error.code === "domain_taken") {
    const errorMessage = "Domain is already being used by a different project";
    log.error(
      safeStringify({
        errorMessage,
        vercelError: error,
      })
    );
    throw new HttpError({
      message: errorMessage,
      statusCode: 400,
    });
  }

  if (error.code === "domain_already_in_use") {
    // Domain is already configured correctly, this is not an error when it happens during creation as it could be re-attempt to create an existing domain
    return true;
  }

  const errorMessage = `Failed to create domain on Vercel: ${error.domain}`;
  log.error(safeStringify({ errorMessage, vercelError: error }));
  throw new HttpError({
    message: errorMessage,
    statusCode: 400,
  });
}

function handleDomainDeletionError(error: {
  code?: string | null;
  domain?: string | null;
  message?: string | null;
  invalidToken?: boolean | null;
}) {
  if (error.code === "not_found") {
    // Domain is already deleted
    return true;
  }

  // Vercel returns "forbidden" for various permission issues, not just domain ownership
  if (error.code === "forbidden") {
    const errorMessage =
      "Vercel denied permission to manage this domain. Please verify your Vercel project, team, and domain permissions.";
    log.error(
      safeStringify({
        errorMessage,
        vercelError: error,
      })
    );
    throw new HttpError({
      message: errorMessage,
      statusCode: 400,
    });
  }

  const errorMessage = `Failed to take action for domain: ${error.domain}`;
  log.error(safeStringify({ errorMessage, vercelError: error }));
  throw new HttpError({
    message: errorMessage,
    statusCode: 400,
  });
}
