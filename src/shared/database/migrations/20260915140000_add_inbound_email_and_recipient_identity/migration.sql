-- CreateEnum
CREATE TYPE "EmailThreadStatus" AS ENUM ('open', 'closed');

-- CreateEnum
CREATE TYPE "EmailMessageDirection" AS ENUM ('inbound', 'outbound');

-- AlterTable
ALTER TABLE "email_domains" ADD COLUMN "inbound_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "mx_verified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "mx_verified_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "email_threads" (
    "id" TEXT NOT NULL,
    "app_id" TEXT NOT NULL,
    "domain_id" TEXT NOT NULL,
    "contact_email" TEXT NOT NULL,
    "subject" TEXT,
    "status" "EmailThreadStatus" NOT NULL DEFAULT 'open',
    "last_message_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_threads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_messages" (
    "id" TEXT NOT NULL,
    "thread_id" TEXT NOT NULL,
    "direction" "EmailMessageDirection" NOT NULL,
    "from_address" TEXT NOT NULL,
    "to_addresses" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "subject" TEXT,
    "text_body" TEXT,
    "html_body" TEXT,
    "message_id_header" TEXT NOT NULL,
    "in_reply_to" TEXT,
    "references" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sent_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_attachments" (
    "id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "storage_url" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipient_identities" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recipient_identities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipient_login_failures" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "ip_address" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "recipient_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recipient_login_failures_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "email_messages_message_id_header_key" ON "email_messages"("message_id_header");

-- CreateIndex
CREATE UNIQUE INDEX "recipient_identities_email_key" ON "recipient_identities"("email");

-- CreateIndex
CREATE INDEX "email_threads_app_id_idx" ON "email_threads"("app_id");

-- CreateIndex
CREATE INDEX "email_threads_domain_id_idx" ON "email_threads"("domain_id");

-- CreateIndex
CREATE INDEX "email_threads_contact_email_idx" ON "email_threads"("contact_email");

-- CreateIndex
CREATE INDEX "email_threads_app_id_last_message_at_idx" ON "email_threads"("app_id", "last_message_at");

-- CreateIndex
CREATE INDEX "email_messages_thread_id_idx" ON "email_messages"("thread_id");

-- CreateIndex
CREATE INDEX "email_messages_in_reply_to_idx" ON "email_messages"("in_reply_to");

-- CreateIndex
CREATE INDEX "email_attachments_message_id_idx" ON "email_attachments"("message_id");

-- CreateIndex
CREATE INDEX "recipient_login_failures_email_created_at_idx" ON "recipient_login_failures"("email", "created_at");

-- CreateIndex
CREATE INDEX "recipient_login_failures_ip_address_created_at_idx" ON "recipient_login_failures"("ip_address", "created_at");

-- AddForeignKey
ALTER TABLE "email_threads" ADD CONSTRAINT "email_threads_app_id_fkey" FOREIGN KEY ("app_id") REFERENCES "apps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_threads" ADD CONSTRAINT "email_threads_domain_id_fkey" FOREIGN KEY ("domain_id") REFERENCES "email_domains"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "email_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_attachments" ADD CONSTRAINT "email_attachments_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "email_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipient_login_failures" ADD CONSTRAINT "recipient_login_failures_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "recipient_identities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
