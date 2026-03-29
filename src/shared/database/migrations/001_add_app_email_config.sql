-- Add AppEmailConfig table for per-app custom sender email configuration

CREATE TABLE IF NOT EXISTS "app_email_configs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "app_id" TEXT NOT NULL UNIQUE,
    "from_email" TEXT NOT NULL,
    "from_name" TEXT,
    "reply_to_email" TEXT,
    "reply_to_name" TEXT,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_email_configs_app_id_fkey" FOREIGN KEY ("app_id") REFERENCES "apps" ("id") ON DELETE CASCADE
);

-- Create index on app_id for faster lookups
CREATE INDEX "app_email_configs_app_id_idx" ON "app_email_configs"("app_id");
