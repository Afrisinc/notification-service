-- AlterTable: Organization gains an optional org-wide Cloudflare API token,
-- used as the default for domain auto-configuration when a domain is added
-- without its own per-domain token (see EmailDomain.cloudflare_api_token).
ALTER TABLE "organizations" ADD COLUMN "cloudflare_api_token" TEXT;
ALTER TABLE "organizations" ADD COLUMN "cloudflare_connected" BOOLEAN NOT NULL DEFAULT false;
