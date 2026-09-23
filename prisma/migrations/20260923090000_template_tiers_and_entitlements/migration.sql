-- Paid tiers. Ready-made templates stay free; richer templates and fully custom builds are paid.
-- Entitlements attach to the experience, not the creator: without accounts a creator is only as
-- durable as a cookie, whereas an experience keeps its manage link.

CREATE TYPE "Tier" AS ENUM ('FREE', 'PLUS', 'PRO');
CREATE TYPE "EntitlementSource" AS ENUM ('COMPLIMENTARY', 'PURCHASE');

ALTER TABLE "Template" ADD COLUMN "tier" "Tier" NOT NULL DEFAULT 'FREE';

CREATE TABLE "Entitlement" (
  "id"           UUID NOT NULL DEFAULT gen_random_uuid(),
  "experienceId" UUID NOT NULL,
  "tier"         "Tier" NOT NULL,
  "source"       "EntitlementSource" NOT NULL,
  "note"         TEXT,
  "providerRef"  TEXT,
  "grantedById"  UUID,
  "createdAt"    TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  "updatedAt"    TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "Entitlement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Entitlement_experienceId_key" ON "Entitlement" ("experienceId");
CREATE UNIQUE INDEX "Entitlement_providerRef_key" ON "Entitlement" ("providerRef");

ALTER TABLE "Entitlement"
  ADD CONSTRAINT "Entitlement_experienceId_fkey"
  FOREIGN KEY ("experienceId") REFERENCES "Experience"("id") ON DELETE CASCADE ON UPDATE CASCADE;
