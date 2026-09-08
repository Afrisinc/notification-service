-- Set default provider to 'internal' for payments table
ALTER TABLE "payments" ALTER COLUMN "provider" SET DEFAULT 'internal';
