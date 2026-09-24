-- Phase 2d-2: scheduled opening, optional PIN (hashed, with lockout), readable short links that
-- only work with the PIN, and daily open counts for creator analytics (no visitor data).
ALTER TABLE "Experience" ADD COLUMN "opensAt" TIMESTAMPTZ(3);
ALTER TABLE "Experience" ADD COLUMN "pinHash" TEXT;
ALTER TABLE "Experience" ADD COLUMN "pinFailures" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Experience" ADD COLUMN "pinLockedUntil" TIMESTAMPTZ(3);
ALTER TABLE "Experience" ADD COLUMN "slug" TEXT;
CREATE UNIQUE INDEX "Experience_slug_key" ON "Experience"("slug");

CREATE TABLE "ExperienceDailyOpen" (
    "experienceId" UUID NOT NULL,
    "day" DATE NOT NULL,
    "opens" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "ExperienceDailyOpen_pkey" PRIMARY KEY ("experienceId", "day")
);
ALTER TABLE "ExperienceDailyOpen" ADD CONSTRAINT "ExperienceDailyOpen_experienceId_fkey"
    FOREIGN KEY ("experienceId") REFERENCES "Experience"("id") ON DELETE CASCADE ON UPDATE CASCADE;
