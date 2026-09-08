-- CreateTable
CREATE TABLE "email_domains" (
    "id" TEXT NOT NULL,
    "app_id" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "selector" TEXT NOT NULL DEFAULT 'afrisinc',
    "dkim_public_key" TEXT,
    "dkim_private_key_path" TEXT,
    "status" "CustomerDomainStatus" NOT NULL DEFAULT 'pending',
    "spf_verified" BOOLEAN NOT NULL DEFAULT false,
    "dkim_verified" BOOLEAN NOT NULL DEFAULT false,
    "dmarc_verified" BOOLEAN NOT NULL DEFAULT false,
    "verified_at" TIMESTAMP(3),
    "cloudflare_zone_id" TEXT,
    "cloudflare_api_token" TEXT,
    "cloudflare_connected" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_domains_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_senders" (
    "id" TEXT NOT NULL,
    "domain_id" TEXT NOT NULL,
    "local_part" TEXT NOT NULL,
    "from_name" TEXT,
    "reply_to_email" TEXT,
    "reply_to_name" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_senders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_email_settings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "from_email" TEXT NOT NULL,
    "from_name" TEXT NOT NULL,
    "support_email" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_email_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "email_domains_app_id_idx" ON "email_domains"("app_id");

-- CreateIndex
CREATE UNIQUE INDEX "email_domains_app_id_domain_key" ON "email_domains"("app_id", "domain");

-- CreateIndex
CREATE INDEX "email_senders_domain_id_idx" ON "email_senders"("domain_id");

-- CreateIndex
CREATE UNIQUE INDEX "email_senders_domain_id_local_part_key" ON "email_senders"("domain_id", "local_part");

-- AddForeignKey
ALTER TABLE "email_domains" ADD CONSTRAINT "email_domains_app_id_fkey" FOREIGN KEY ("app_id") REFERENCES "apps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_senders" ADD CONSTRAINT "email_senders_domain_id_fkey" FOREIGN KEY ("domain_id") REFERENCES "email_domains"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed the platform default sender from existing env-var behavior (FROM_EMAIL /
-- COMPANY_NAME / SUPPORT_EMAIL defaults in src/services/api/src/config/env.ts),
-- so behavior is unchanged until an admin edits it from the dashboard.
INSERT INTO "platform_email_settings" ("id", "from_email", "from_name", "support_email", "updated_at")
VALUES ('default', 'noreply@afrisinc.com', 'Afrisinc', 'support@afrisinc.com', CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
