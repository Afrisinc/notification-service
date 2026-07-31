-- CreateEnum
CREATE TYPE "CreditTransactionStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

-- AlterTable
ALTER TABLE "credit_transactions" ADD COLUMN "status" "CreditTransactionStatus" NOT NULL DEFAULT 'PENDING';

-- CreateIndex
CREATE INDEX "credit_transactions_status_idx" ON "credit_transactions"("status");

-- CreateIndex
CREATE INDEX "credit_transactions_payment_ref_idx" ON "credit_transactions"("payment_ref");
