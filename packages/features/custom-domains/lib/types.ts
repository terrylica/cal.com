import type {
  VercelConfigResponse,
  VercelDomainResponse,
} from "@calcom/lib/domainManager/deploymentServices/vercel";
import type { CustomDomain } from "@calcom/prisma/client";

export type { VercelConfigResponse, VercelDomainResponse };

export enum DomainVerificationStatus {
  VALID = "Valid Configuration",
  PENDING = "Pending Verification",
  NOT_FOUND = "Domain Not Found",
  INVALID = "Invalid Configuration",
  CONFLICTING = "Conflicting DNS Records",
  UNKNOWN = "Unknown Error",
}

export interface DomainVerificationResult {
  status: DomainVerificationStatus;
  domainJson?: VercelDomainResponse;
  configJson?: VercelConfigResponse;
}

export type CustomDomainWithTeam = CustomDomain & {
  team: {
    id: number;
    slug: string | null;
    name: string;
  };
};
