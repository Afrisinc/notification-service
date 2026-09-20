-- AlterTable: EmailDomain becomes assignable to an Organization directly,
-- alongside the existing per-App ownership. app_id is widened to nullable
-- since org-owned domains have no App at all.
ALTER TABLE "email_domains" ALTER COLUMN "app_id" DROP NOT NULL;
ALTER TABLE "email_domains" ADD COLUMN "organization_id" TEXT;

-- AlterTable: EmailSender gains an optional assigned member.
ALTER TABLE "email_senders" ADD COLUMN "assigned_user_id" TEXT;

-- AlterTable: EmailThread becomes findable by organization directly (both
-- legacy app-based and new org-composed threads), and app_id is widened to
-- nullable since org-composed threads have no App.
ALTER TABLE "email_threads" ALTER COLUMN "app_id" DROP NOT NULL;
ALTER TABLE "email_threads" ADD COLUMN "organization_id" TEXT;

-- AlterTable: EmailMessage gains CC recipients.
ALTER TABLE "email_messages" ADD COLUMN "cc_addresses" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateIndex
-- Safe: organization_id is NULL on every existing row, and Postgres treats
-- NULLs as distinct for uniqueness, so this cannot fail on existing data.
CREATE UNIQUE INDEX "email_domains_organization_id_domain_key" ON "email_domains"("organization_id", "domain");

-- CreateIndex
CREATE INDEX "email_domains_organization_id_idx" ON "email_domains"("organization_id");

-- CreateIndex
CREATE INDEX "email_senders_assigned_user_id_idx" ON "email_senders"("assigned_user_id");

-- CreateIndex
CREATE INDEX "email_threads_organization_id_idx" ON "email_threads"("organization_id");

-- CreateIndex
CREATE INDEX "email_threads_organization_id_last_message_at_idx" ON "email_threads"("organization_id", "last_message_at");

-- Backfill organization_id onto every existing app-based EmailDomain/EmailThread
-- from their App's organization (falling back to the App's Account's
-- organization, matching the existing "legacy app" fallback pattern already
-- used elsewhere in this codebase for apps with a null organization_id).
UPDATE "email_domains" ed
SET "organization_id" = COALESCE(a."organization_id", acc."organization_id")
FROM "apps" a
JOIN "accounts" acc ON acc."id" = a."account_id"
WHERE ed."app_id" = a."id" AND ed."organization_id" IS NULL;

UPDATE "email_threads" et
SET "organization_id" = COALESCE(a."organization_id", acc."organization_id")
FROM "apps" a
JOIN "accounts" acc ON acc."id" = a."account_id"
WHERE et."app_id" = a."id" AND et."organization_id" IS NULL;

-- AddForeignKey
ALTER TABLE "email_domains" ADD CONSTRAINT "email_domains_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_senders" ADD CONSTRAINT "email_senders_assigned_user_id_fkey" FOREIGN KEY ("assigned_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_threads" ADD CONSTRAINT "email_threads_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
