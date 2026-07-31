-- CreateTable PaymentInit
CREATE TABLE "payment_inits" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "payment_type" TEXT,
    "template_id" TEXT,
    "app_id" TEXT,
    "plan_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_inits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payment_inits_ref_key" ON "payment_inits"("ref");

-- CreateIndex
CREATE INDEX "payment_inits_account_id_idx" ON "payment_inits"("account_id");

-- CreateIndex
CREATE INDEX "payment_inits_ref_idx" ON "payment_inits"("ref");

-- CreateIndex
CREATE INDEX "payment_inits_status_idx" ON "payment_inits"("status");
