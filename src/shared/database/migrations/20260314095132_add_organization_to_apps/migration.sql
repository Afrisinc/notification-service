/*
  Warnings:

  - You are about to drop the column `tenantId` on the `api_keys` table. All the data in the column will be lost.
  - You are about to drop the column `tenantId` on the `notifications` table. All the data in the column will be lost.
  - You are about to drop the column `tenantId` on the `templates` table. All the data in the column will be lost.
  - You are about to drop the column `tenantId` on the `user_preferences` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `user_preferences` table. All the data in the column will be lost.
  - You are about to drop the `account_products` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `products` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `projects` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `template_installations` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `tenants` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[slug]` on the table `organizations` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[account_id,code,channel,language]` on the table `templates` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[account_id,user_id,channel]` on the table `user_preferences` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `account_id` to the `api_keys` table without a default value. This is not possible if the table is not empty.
  - Added the required column `account_id` to the `notifications` table without a default value. This is not possible if the table is not empty.
  - Added the required column `account_id` to the `templates` table without a default value. This is not possible if the table is not empty.
  - Added the required column `created_by_user_id` to the `templates` table without a default value. This is not possible if the table is not empty.
  - Added the required column `account_id` to the `user_preferences` table without a default value. This is not possible if the table is not empty.
  - Added the required column `user_id` to the `user_preferences` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "Environment" AS ENUM ('production', 'staging', 'development');

-- DropForeignKey
ALTER TABLE "account_products" DROP CONSTRAINT "account_products_account_id_fkey";

-- DropForeignKey
ALTER TABLE "account_products" DROP CONSTRAINT "account_products_product_id_fkey";

-- DropForeignKey
ALTER TABLE "api_keys" DROP CONSTRAINT "api_keys_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "projects" DROP CONSTRAINT "projects_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "template_installations" DROP CONSTRAINT "template_installations_projectId_fkey";

-- DropForeignKey
ALTER TABLE "template_installations" DROP CONSTRAINT "template_installations_templateId_fkey";

-- DropForeignKey
ALTER TABLE "templates" DROP CONSTRAINT "templates_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "user_preferences" DROP CONSTRAINT "user_preferences_tenantId_fkey";

-- DropIndex
DROP INDEX "api_keys_tenantId_idx";

-- DropIndex
DROP INDEX "notifications_tenantId_status_idx";

-- DropIndex
DROP INDEX "templates_tenantId_active_idx";

-- DropIndex
DROP INDEX "templates_tenantId_category_idx";

-- DropIndex
DROP INDEX "templates_tenantId_code_channel_active_idx";

-- DropIndex
DROP INDEX "templates_tenantId_code_channel_language_key";

-- DropIndex
DROP INDEX "templates_tenantId_deletedAt_idx";

-- DropIndex
DROP INDEX "user_preferences_tenantId_userId_channel_key";

-- AlterTable
ALTER TABLE "api_keys" DROP COLUMN "tenantId",
ADD COLUMN     "account_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "notifications" DROP COLUMN "tenantId",
ADD COLUMN     "account_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "slug" TEXT;

-- AlterTable
ALTER TABLE "templates" DROP COLUMN "tenantId",
ADD COLUMN     "account_id" TEXT NOT NULL,
ADD COLUMN     "created_by_user_id" TEXT NOT NULL,
ADD COLUMN     "is_public" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "price" DOUBLE PRECISION,
ADD COLUMN     "visibility" TEXT NOT NULL DEFAULT 'private';

-- AlterTable
ALTER TABLE "user_preferences" DROP COLUMN "tenantId",
DROP COLUMN "userId",
ADD COLUMN     "account_id" TEXT NOT NULL,
ADD COLUMN     "user_id" TEXT NOT NULL;

-- DropTable
DROP TABLE "account_products";

-- DropTable
DROP TABLE "products";

-- DropTable
DROP TABLE "projects";

-- DropTable
DROP TABLE "template_installations";

-- DropTable
DROP TABLE "tenants";

-- DropEnum
DROP TYPE "TenantStatus";

-- CreateTable
CREATE TABLE "app_templates" (
    "id" TEXT NOT NULL,
    "app_id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "customizations" JSONB,
    "status" TEXT NOT NULL DEFAULT 'active',
    "installationDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "apps" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "organization_id" TEXT,
    "name" TEXT NOT NULL,
    "environment" "Environment" NOT NULL DEFAULT 'production',
    "api_key" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "apps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "subscription_id" TEXT NOT NULL,
    "invoice_number" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" TEXT NOT NULL,
    "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "due_at" TIMESTAMP(3) NOT NULL,
    "paid_at" TIMESTAMP(3),
    "provider_id" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_limits" (
    "id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "limit_value" INTEGER NOT NULL,
    "period" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plan_limits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plans" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price_monthly" DOUBLE PRECISION NOT NULL,
    "price_yearly" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "billing_cycle" TEXT NOT NULL,
    "current_period_start" TIMESTAMP(3) NOT NULL,
    "current_period_end" TIMESTAMP(3) NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_id" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "canceled_at" TIMESTAMP(3),

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usage_records" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "app_id" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usage_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "app_templates_app_id_idx" ON "app_templates"("app_id");

-- CreateIndex
CREATE INDEX "app_templates_template_id_idx" ON "app_templates"("template_id");

-- CreateIndex
CREATE UNIQUE INDEX "app_templates_app_id_template_id_key" ON "app_templates"("app_id", "template_id");

-- CreateIndex
CREATE UNIQUE INDEX "apps_api_key_key" ON "apps"("api_key");

-- CreateIndex
CREATE INDEX "apps_account_id_idx" ON "apps"("account_id");

-- CreateIndex
CREATE INDEX "apps_organization_id_idx" ON "apps"("organization_id");

-- CreateIndex
CREATE INDEX "apps_api_key_idx" ON "apps"("api_key");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_invoice_number_key" ON "invoices"("invoice_number");

-- CreateIndex
CREATE INDEX "invoices_subscription_id_idx" ON "invoices"("subscription_id");

-- CreateIndex
CREATE INDEX "invoices_status_idx" ON "invoices"("status");

-- CreateIndex
CREATE INDEX "invoices_issued_at_idx" ON "invoices"("issued_at");

-- CreateIndex
CREATE INDEX "plan_limits_plan_id_idx" ON "plan_limits"("plan_id");

-- CreateIndex
CREATE UNIQUE INDEX "plan_limits_plan_id_metric_key" ON "plan_limits"("plan_id", "metric");

-- CreateIndex
CREATE UNIQUE INDEX "plans_name_key" ON "plans"("name");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_account_id_key" ON "subscriptions"("account_id");

-- CreateIndex
CREATE INDEX "subscriptions_account_id_idx" ON "subscriptions"("account_id");

-- CreateIndex
CREATE INDEX "subscriptions_plan_id_idx" ON "subscriptions"("plan_id");

-- CreateIndex
CREATE INDEX "subscriptions_provider_id_idx" ON "subscriptions"("provider_id");

-- CreateIndex
CREATE INDEX "usage_records_account_id_idx" ON "usage_records"("account_id");

-- CreateIndex
CREATE INDEX "usage_records_app_id_idx" ON "usage_records"("app_id");

-- CreateIndex
CREATE INDEX "usage_records_timestamp_idx" ON "usage_records"("timestamp");

-- CreateIndex
CREATE INDEX "usage_records_metric_idx" ON "usage_records"("metric");

-- CreateIndex
CREATE INDEX "api_keys_account_id_idx" ON "api_keys"("account_id");

-- CreateIndex
CREATE INDEX "notifications_account_id_status_idx" ON "notifications"("account_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE INDEX "templates_account_id_active_idx" ON "templates"("account_id", "active");

-- CreateIndex
CREATE INDEX "templates_account_id_category_idx" ON "templates"("account_id", "category");

-- CreateIndex
CREATE INDEX "templates_account_id_code_channel_active_idx" ON "templates"("account_id", "code", "channel", "active");

-- CreateIndex
CREATE INDEX "templates_account_id_deletedAt_idx" ON "templates"("account_id", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "templates_account_id_code_channel_language_key" ON "templates"("account_id", "code", "channel", "language");

-- CreateIndex
CREATE UNIQUE INDEX "user_preferences_account_id_user_id_channel_key" ON "user_preferences"("account_id", "user_id", "channel");

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_templates" ADD CONSTRAINT "app_templates_app_id_fkey" FOREIGN KEY ("app_id") REFERENCES "apps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_templates" ADD CONSTRAINT "app_templates_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "apps" ADD CONSTRAINT "apps_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "apps" ADD CONSTRAINT "apps_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_limits" ADD CONSTRAINT "plan_limits_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "templates" ADD CONSTRAINT "templates_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "templates" ADD CONSTRAINT "templates_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_records" ADD CONSTRAINT "usage_records_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_records" ADD CONSTRAINT "usage_records_app_id_fkey" FOREIGN KEY ("app_id") REFERENCES "apps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
