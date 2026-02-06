-- Note: We are defaulting these enums to SEATS based approach - the tables are pretty damn small in size so its easier i
-- we just set defaults here
-- CreateEnum
CREATE TYPE "BillingModel" AS ENUM ('SEATS', 'ACTIVE_USERS');

-- AlterTable
-- ~3,700 in length right now (not fully backfilled)
ALTER TABLE "TeamBilling" ADD COLUMN "billingModel" "BillingModel" NOT NULL DEFAULT 'SEATS';

-- AlterTable
-- 290 in length right now
ALTER TABLE "OrganizationBilling" ADD COLUMN "billingModel" "BillingModel" NOT NULL DEFAULT 'SEATS';
