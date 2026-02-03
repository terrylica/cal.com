/**
 * Centralized public environment variables for Next.js applications.
 *
 * This file is the ONLY place where process.env.NEXT_PUBLIC_* should be accessed directly.
 * All other files should import from this module to get public env var values.
 *
 * Why this pattern?
 * 1. Next.js replaces process.env.NEXT_PUBLIC_* at build time, but only when `process` is the global.
 * 2. Biome's noProcessGlobal rule auto-fixes by adding `import process from "node:process"`,
 *    which breaks Next.js's compile-time replacement (the imported process module is undefined in browser).
 * 3. By centralizing all NEXT_PUBLIC_* access here, we can configure Biome to allow process.env
 *    only in this file, preventing the auto-import issue elsewhere.
 * 4. This also provides type safety - all env vars are typed and have sensible defaults.
 *
 * Usage:
 *   import { NEXT_PUBLIC_WEBAPP_URL } from "@calcom/lib/public-env";
 *
 * Adding new env vars:
 *   1. Add the env var to this file with appropriate typing and default value
 *   2. Export it for use in other files
 */

// =============================================================================
// Node Environment
// =============================================================================

export const isENVProd = process.env.NODE_ENV === "production";
export const isENVDev = process.env.NODE_ENV === "development";

// =============================================================================
// Core URLs
// =============================================================================

/** The main webapp URL (e.g., https://app.cal.com) */
export const NEXT_PUBLIC_WEBAPP_URL = process.env.NEXT_PUBLIC_WEBAPP_URL;

/** The marketing website URL (e.g., https://cal.com) */
export const NEXT_PUBLIC_WEBSITE_URL = process.env.NEXT_PUBLIC_WEBSITE_URL;

/** Vercel deployment URL */
export const NEXT_PUBLIC_VERCEL_URL = process.env.NEXT_PUBLIC_VERCEL_URL;

/** Embed library URL */
export const NEXT_PUBLIC_EMBED_LIB_URL = process.env.NEXT_PUBLIC_EMBED_LIB_URL;

/** API v2 URL for platform integrations */
export const NEXT_PUBLIC_API_V2_URL = process.env.NEXT_PUBLIC_API_V2_URL;

// =============================================================================
// Branding & Identity
// =============================================================================

/** Application name displayed in UI */
export const NEXT_PUBLIC_APP_NAME = process.env.NEXT_PUBLIC_APP_NAME;

/** Company name for legal/branding purposes */
export const NEXT_PUBLIC_COMPANY_NAME = process.env.NEXT_PUBLIC_COMPANY_NAME;

/** Support email address */
export const NEXT_PUBLIC_SUPPORT_MAIL_ADDRESS = process.env.NEXT_PUBLIC_SUPPORT_MAIL_ADDRESS;

/** Sender ID for SMS/notifications */
export const NEXT_PUBLIC_SENDER_ID = process.env.NEXT_PUBLIC_SENDER_ID;

/** SendGrid sender name for emails */
export const NEXT_PUBLIC_SENDGRID_SENDER_NAME = process.env.NEXT_PUBLIC_SENDGRID_SENDER_NAME;

/** Cal.com version string */
export const NEXT_PUBLIC_CALCOM_VERSION = process.env.NEXT_PUBLIC_CALCOM_VERSION;

// =============================================================================
// Feature Flags & Configuration
// =============================================================================

/** Whether this is running in E2E test mode */
export const NEXT_PUBLIC_IS_E2E = process.env.NEXT_PUBLIC_IS_E2E;

/** Whether signup is disabled */
export const NEXT_PUBLIC_DISABLE_SIGNUP = process.env.NEXT_PUBLIC_DISABLE_SIGNUP;

/** Whether hosted Cal.com features are enabled */
export const NEXT_PUBLIC_HOSTED_CAL_FEATURES = process.env.NEXT_PUBLIC_HOSTED_CAL_FEATURES;

/** Whether profile switcher is enabled */
export const NEXT_PUBLIC_ENABLE_PROFILE_SWITCHER = process.env.NEXT_PUBLIC_ENABLE_PROFILE_SWITCHER;

/** Whether org self-serve is enabled */
export const NEXT_PUBLIC_ORG_SELF_SERVE_ENABLED = process.env.NEXT_PUBLIC_ORG_SELF_SERVE_ENABLED;

/** Whether team impersonation is enabled */
export const NEXT_PUBLIC_TEAM_IMPERSONATION = process.env.NEXT_PUBLIC_TEAM_IMPERSONATION;

/** Single org mode slug (for white-label deployments) */
export const NEXT_PUBLIC_SINGLE_ORG_SLUG = process.env.NEXT_PUBLIC_SINGLE_ORG_SLUG;

// =============================================================================
// Stripe & Payments
// =============================================================================

/** Stripe public key for client-side operations */
export const NEXT_PUBLIC_STRIPE_PUBLIC_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY;

/** Stripe premium plan monthly price ID */
export const NEXT_PUBLIC_STRIPE_PREMIUM_PLAN_PRICE_MONTHLY = process.env.NEXT_PUBLIC_STRIPE_PREMIUM_PLAN_PRICE_MONTHLY;

/** Stripe premium plan product ID */
export const NEXT_PUBLIC_STRIPE_PREMIUM_PLAN_PRODUCT_ID = process.env.NEXT_PUBLIC_STRIPE_PREMIUM_PLAN_PRODUCT_ID;

/** Stripe team monthly price ID */
export const NEXT_PUBLIC_STRIPE_TEAM_MONTHLY_PRICE_ID = process.env.NEXT_PUBLIC_STRIPE_TEAM_MONTHLY_PRICE_ID;

/** Stripe credits price ID for SMS credits */
export const NEXT_PUBLIC_STRIPE_CREDITS_PRICE_ID = process.env.NEXT_PUBLIC_STRIPE_CREDITS_PRICE_ID;

/** Organization self-serve price */
export const NEXT_PUBLIC_ORGANIZATIONS_SELF_SERVE_PRICE_NEW = process.env.NEXT_PUBLIC_ORGANIZATIONS_SELF_SERVE_PRICE_NEW;

// =============================================================================
// Analytics & Tracking
// =============================================================================

/** PostHog API key */
export const NEXT_PUBLIC_POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;

/** PostHog host URL */
export const NEXT_PUBLIC_POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST;

/** Google Tag Manager ID */
export const NEXT_PUBLIC_GTM_ID = process.env.NEXT_PUBLIC_GTM_ID;

/** Sentry DSN for error tracking */
export const NEXT_PUBLIC_SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

/** Sentry DSN for client-side error tracking */
export const NEXT_PUBLIC_SENTRY_DSN_CLIENT = process.env.NEXT_PUBLIC_SENTRY_DSN_CLIENT;

/** Formbricks host URL */
export const NEXT_PUBLIC_FORMBRICKS_HOST_URL = process.env.NEXT_PUBLIC_FORMBRICKS_HOST_URL;

/** Formbricks environment ID */
export const NEXT_PUBLIC_FORMBRICKS_ENVIRONMENT_ID = process.env.NEXT_PUBLIC_FORMBRICKS_ENVIRONMENT_ID;

/** Dub referrals program ID */
export const NEXT_PUBLIC_DUB_PROGRAM_ID = process.env.NEXT_PUBLIC_DUB_PROGRAM_ID;

// =============================================================================
// Support & Chat
// =============================================================================

/** Intercom app ID */
export const NEXT_PUBLIC_INTERCOM_APP_ID = process.env.NEXT_PUBLIC_INTERCOM_APP_ID;

/** Helpscout beacon key */
export const NEXT_PUBLIC_HELPSCOUT_KEY = process.env.NEXT_PUBLIC_HELPSCOUT_KEY;

/** Zendesk widget key */
export const NEXT_PUBLIC_ZENDESK_KEY = process.env.NEXT_PUBLIC_ZENDESK_KEY;

/** Freshchat host */
export const NEXT_PUBLIC_FRESHCHAT_HOST = process.env.NEXT_PUBLIC_FRESHCHAT_HOST;

/** Freshchat token */
export const NEXT_PUBLIC_FRESHCHAT_TOKEN = process.env.NEXT_PUBLIC_FRESHCHAT_TOKEN;

// =============================================================================
// Cloudflare & Security
// =============================================================================

/** Cloudflare Turnstile site key */
export const NEXT_PUBLIC_CLOUDFLARE_SITEKEY = process.env.NEXT_PUBLIC_CLOUDFLARE_SITEKEY;

/** Whether to use Turnstile in booker */
export const NEXT_PUBLIC_CLOUDFLARE_USE_TURNSTILE_IN_BOOKER = process.env.NEXT_PUBLIC_CLOUDFLARE_USE_TURNSTILE_IN_BOOKER;

// =============================================================================
// Booking & Scheduling
// =============================================================================

/** Number of days to load in booker */
export const NEXT_PUBLIC_BOOKER_NUMBER_OF_DAYS_TO_LOAD = process.env.NEXT_PUBLIC_BOOKER_NUMBER_OF_DAYS_TO_LOAD;

/** Minutes to book (reservation timeout) */
export const NEXT_PUBLIC_MINUTES_TO_BOOK = process.env.NEXT_PUBLIC_MINUTES_TO_BOOK;

/** Query reservation interval in seconds */
export const NEXT_PUBLIC_QUERY_RESERVATION_INTERVAL_SECONDS = process.env.NEXT_PUBLIC_QUERY_RESERVATION_INTERVAL_SECONDS;

/** Query reservation stale time in seconds */
export const NEXT_PUBLIC_QUERY_RESERVATION_STALE_TIME_SECONDS = process.env.NEXT_PUBLIC_QUERY_RESERVATION_STALE_TIME_SECONDS;

/** Query available slots interval in seconds */
export const NEXT_PUBLIC_QUERY_AVAILABLE_SLOTS_INTERVAL_SECONDS = process.env.NEXT_PUBLIC_QUERY_AVAILABLE_SLOTS_INTERVAL_SECONDS;

/** Whether to invalidate available slots on booking form */
export const NEXT_PUBLIC_INVALIDATE_AVAILABLE_SLOTS_ON_BOOKING_FORM = process.env.NEXT_PUBLIC_INVALIDATE_AVAILABLE_SLOTS_ON_BOOKING_FORM;

/** Quick availability rollout percentage (0-100) */
export const NEXT_PUBLIC_QUICK_AVAILABILITY_ROLLOUT = process.env.NEXT_PUBLIC_QUICK_AVAILABILITY_ROLLOUT;

// =============================================================================
// Web Push & Notifications
// =============================================================================

/** VAPID public key for web push notifications */
export const NEXT_PUBLIC_VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

// =============================================================================
// Logging & Debugging
// =============================================================================

/** Logger level (0=silly, 1=trace, 2=debug, 3=info, 4=warn, 5=error, 6=fatal) */
export const NEXT_PUBLIC_LOGGER_LEVEL = process.env.NEXT_PUBLIC_LOGGER_LEVEL;

// =============================================================================
// Legal & Compliance
// =============================================================================

/** Privacy policy URL */
export const NEXT_PUBLIC_WEBSITE_PRIVACY_POLICY_URL = process.env.NEXT_PUBLIC_WEBSITE_PRIVACY_POLICY_URL;

/** Terms of service URL */
export const NEXT_PUBLIC_WEBSITE_TERMS_URL = process.env.NEXT_PUBLIC_WEBSITE_TERMS_URL;

// =============================================================================
// Custom Scripts
// =============================================================================

/** Custom head scripts to inject */
export const NEXT_PUBLIC_HEAD_SCRIPTS = process.env.NEXT_PUBLIC_HEAD_SCRIPTS;

/** Custom body scripts to inject */
export const NEXT_PUBLIC_BODY_SCRIPTS = process.env.NEXT_PUBLIC_BODY_SCRIPTS;

// =============================================================================
// Cal AI & Phone
// =============================================================================

/** Cal AI phone number monthly price */
export const NEXT_PUBLIC_CAL_AI_PHONE_NUMBER_MONTHLY_PRICE = process.env.NEXT_PUBLIC_CAL_AI_PHONE_NUMBER_MONTHLY_PRICE;

// =============================================================================
// Third-party Integrations
// =============================================================================

/** HitPay production API URL */
export const NEXT_PUBLIC_API_HITPAY_PRODUCTION = process.env.NEXT_PUBLIC_API_HITPAY_PRODUCTION;

/** HitPay sandbox API URL */
export const NEXT_PUBLIC_API_HITPAY_SANDBOX = process.env.NEXT_PUBLIC_API_HITPAY_SANDBOX;

// =============================================================================
// Vercel-specific
// =============================================================================

/** Whether to use bot ID in booker (Vercel-specific) */
export const NEXT_PUBLIC_VERCEL_USE_BOTID_IN_BOOKER = process.env.NEXT_PUBLIC_VERCEL_USE_BOTID_IN_BOOKER
