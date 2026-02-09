import { checkIfFreeEmailDomain } from "@calcom/features/watchlist/lib/freeEmailDomainCheck/checkIfFreeEmailDomain";

const PROTECTED_SLUGS = [
  "walmart",
  "amazon",
  "apple",
  "exxonmobil",
  "exxon",
  "berkshire",
  "berkshirehathaway",
  "unitedhealth",
  "mckesson",
  "cvs",
  "alphabet",
  "google",
  "cencora",
  "costco",
  "microsoft",
  "cardinal",
  "cardinalhealth",
  "chevron",
  "cigna",
  "elevance",
  "fanniemae",
  "marathon",
  "phillips66",
  "valero",
  "ford",
  "generalmotors",
  "gm",
  "jpmorgan",
  "jpmorganchase",
  "chase",
  "centene",
  "verizon",
  "att",
  "kroger",
  "walgreens",
  "comcast",
  "meta",
  "facebook",
  "homedepot",
  "homedepot",
  "bank-of-america",
  "bankofamerica",
  "bofa",
  "target",
  "dell",
  "archer-daniels",
  "archerdaniels",
  "pfizer",
  "ups",
  "freddiemac",
  "lowes",
  "unitedparcel",
  "johnson",
  "johnsonandjohnson",
  "jnj",
  "humana",
  "energytransfer",
  "state-farm",
  "statefarm",
  "tesla",
  "disney",
  "boeing",
  "merck",
  "goldman",
  "goldmansachs",
  "abbvie",
  "morgan-stanley",
  "morganstanley",
  "citi",
  "citigroup",
  "lockheed",
  "lockheedmartin",
  "raytheon",
  "rtx",
  "intel",
  "ibm",
  "caterpillar",
  "cisco",
  "pepsico",
  "pepsi",
  "cocacola",
  "coca-cola",
  "coke",
  "nike",
  "adobe",
  "oracle",
  "salesforce",
  "netflix",
  "nvidia",
  "uber",
  "airbnb",
  "paypal",
  "stripe",
  "github",
  "gitlab",
  "linkedin",
  "twitter",
  "snap",
  "snapchat",
  "spotify",
  "slack",
  "zoom",
  "dropbox",
  "shopify",
  "squarespace",
  "twilio",
  "databricks",
  "snowflake",
  "palantir",
  "samsung",
  "sony",
  "toyota",
  "honda",
  "bmw",
  "mercedes",
  "porsche",
  "volkswagen",
  "siemens",
  "nestle",
  "unilever",
  "loreal",
  "lvmh",
  "hsbc",
  "barclays",
  "visa",
  "mastercard",
  "amex",
  "americanexpress",
  "wellsfargo",
  "deloitte",
  "pwc",
  "ey",
  "kpmg",
  "mckinsey",
  "accenture",
  "bain",
  "bcg",
];

export class OrganizationSlugService {
  isProtectedSlug(slug: string): boolean {
    return PROTECTED_SLUGS.includes(slug.toLowerCase());
  }

  async isOwnerEmailFreeEmailDomain(email: string): Promise<boolean> {
    return checkIfFreeEmailDomain({ email });
  }

  async validateSlugForOrgCreation({
    slug,
    ownerEmail,
  }: {
    slug: string;
    ownerEmail: string;
  }): Promise<{ allowed: boolean; reason?: string }> {
    const isFreeEmail = await this.isOwnerEmailFreeEmailDomain(ownerEmail);
    const isProtected = this.isProtectedSlug(slug);

    if (!isProtected) {
      return { allowed: true };
    }

    if (isFreeEmail) {
      return {
        allowed: false,
        reason: "protected_slug_requires_company_email",
      };
    }

    const emailDomain = ownerEmail.split("@")[1]?.toLowerCase() ?? "";
    const slugMatchesDomain = emailDomain.startsWith(slug.toLowerCase());

    if (!slugMatchesDomain) {
      return {
        allowed: false,
        reason: "protected_slug_requires_matching_domain",
      };
    }

    return { allowed: true };
  }
}
