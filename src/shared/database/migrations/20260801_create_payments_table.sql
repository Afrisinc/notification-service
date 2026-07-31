-- CreateEnum PaymentType
CREATE TYPE "PaymentType" AS ENUM ('payg_topup', 'subscription', 'template_purchase', 'deduction', 'bonus', 'refund');

-- CreateEnum TransactionType
CREATE TYPE "TransactionType" AS ENUM ('topup', 'deduction', 'bonus', 'refund');

-- CreateTable Payments
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "method" TEXT,
    "amount" INTEGER NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'USD',
    "type" "PaymentType" NOT NULL,
    "transaction_type" "TransactionType",
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "transaction_id" TEXT,
    "provider" TEXT,
    "provider_status" TEXT,
    "template_id" TEXT,
    "app_id" TEXT,
    "plan_id" TEXT,
    "credit_transaction_id" TEXT,
    "subscription_id" TEXT,
    "app_template_id" TEXT,
    "email" TEXT,
    "phone_number" TEXT,
    "customer_name" TEXT,
    "recipient" TEXT,
    "bonus_amount" INTEGER,
    "bonus_percent" INTEGER,
    "new_balance" INTEGER,
    "initiated_at" TIMESTAMP(3),
    "processed_at" TIMESTAMP(3),
    "failure_reason" TEXT,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payments_ref_key" ON "payments"("ref");

-- CreateIndex
CREATE INDEX "payments_account_id_idx" ON "payments"("account_id");

-- CreateIndex
CREATE INDEX "payments_order_id_idx" ON "payments"("order_id");

-- CreateIndex
CREATE INDEX "payments_status_idx" ON "payments"("status");

-- CreateIndex
CREATE INDEX "payments_type_idx" ON "payments"("type");

-- CreateIndex
CREATE INDEX "payments_transaction_type_idx" ON "payments"("transaction_type");

-- CreateIndex
CREATE INDEX "payments_created_at_idx" ON "payments"("created_at");
