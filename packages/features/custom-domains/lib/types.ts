import type { CustomDomain } from "@calcom/prisma/client";

export type DomainVerificationStatus =
  | "Valid Configuration"
  | "Pending Verification"
  | "Domain Not Found"
  | "Invalid Configuration"
  | "Conflicting DNS Records"
  | "Unknown Error";

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

export interface DomainVerificationResult {
  status: DomainVerificationStatus;
  domainJson?: VercelDomainResponse;
  configJson?: VercelConfigResponse;
  verificationJson?: VercelDomainResponse;
}

export type CustomDomainWithTeam = CustomDomain & {
  team: {
    id: number;
    slug: string | null;
    name: string;
  };
};
