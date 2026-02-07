-- CreateEnum
CREATE TYPE "public"."UserLockReason" AS ENUM ('WATCHLIST_EMAIL_MATCH', 'WATCHLIST_DOMAIN_MATCH', 'RATE_LIMIT_EXCEEDED', 'SPAM_WORKFLOW_BODY', 'MALICIOUS_URL_IN_WORKFLOW', 'ADMIN_ACTION');

-- CreateTable
CREATE TABLE "public"."user_locks" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "reason" "public"."UserLockReason" NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_locks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_locks_userId_idx" ON "public"."user_locks"("userId");

-- AddForeignKey
ALTER TABLE "public"."user_locks" ADD CONSTRAINT "user_locks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
