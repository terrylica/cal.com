export * from "./getTeamByCustomDomain";
export * from "./types";
export * from "./verify-domain";

export const DNS_CONFIG = {
  A_RECORD_IP: "76.76.21.21",
  CNAME_TARGET: "cname.vercel-dns.com",
  DEFAULT_TTL: 86400,
} as const;
