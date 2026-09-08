-- AddColumn exchange_rate, base_code, target_code, amount_local to payments
ALTER TABLE "payments" ADD COLUMN "exchange_rate" DOUBLE PRECISION;
ALTER TABLE "payments" ADD COLUMN "base_code" TEXT;
ALTER TABLE "payments" ADD COLUMN "target_code" TEXT;
ALTER TABLE "payments" ADD COLUMN "amount_local" INTEGER;

-- CreateIndex for exchange rate tracking
CREATE INDEX "payments_exchange_rate_idx" ON "payments"("exchange_rate");
CREATE INDEX "payments_base_code_idx" ON "payments"("base_code");
