-- AlterTable
ALTER TABLE "notifications" ADD COLUMN "refundedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "notifications_status_createdAt_idx" ON "notifications"("status", "createdAt");

-- CreateIndex (idempotency guard: at most one refund transaction per notification)
CREATE UNIQUE INDEX "credit_transactions_refund_notification_unique" ON "credit_transactions"("notification_id") WHERE "type" = 'refund';
