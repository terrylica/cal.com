-- AlterTable: Add high water mark tracking fields for monthly billing
ALTER TABLE "TeamBilling" ADD COLUMN "highWaterMark" INTEGER,
ADD COLUMN "highWaterMarkPeriodStart" TIMESTAMP(3);

-- AlterTable: Add high water mark tracking fields for monthly billing (organizations)
ALTER TABLE "OrganizationBilling" ADD COLUMN "highWaterMark" INTEGER,
ADD COLUMN "highWaterMarkPeriodStart" TIMESTAMP(3);
