-- AlterTable
ALTER TABLE "credit_transactions" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'PENDING';

-- CreateIndex
CREATE INDEX "credit_transactions_status_idx" ON "credit_transactions"("status");

-- CreateIndex
CREATE INDEX "credit_transactions_payment_ref_idx" ON "credit_transactions"("payment_ref");
