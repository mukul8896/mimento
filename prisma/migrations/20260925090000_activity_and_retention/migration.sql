-- Activity tracking for retention: surprises nobody has used for a year, and owners with nothing
-- left who have not been back for a year, are removed by the worker (RETENTION_DAYS).
ALTER TABLE "UserProfile" ADD COLUMN "lastSeenAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
UPDATE "UserProfile" SET "lastSeenAt" = "updatedAt";
CREATE INDEX "UserProfile_lastSeenAt_idx" ON "UserProfile"("lastSeenAt");

ALTER TABLE "Experience" ADD COLUMN "lastActivityAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Experience" ADD COLUMN "retentionWarnedAt" TIMESTAMPTZ(3);
-- Existing rows: the later of the last edit and the last day a recipient opened it.
UPDATE "Experience" e SET "lastActivityAt" = GREATEST(
  e."updatedAt",
  COALESCE((SELECT MAX(o."day")::timestamptz FROM "ExperienceDailyOpen" o WHERE o."experienceId" = e."id"), e."updatedAt")
);
CREATE INDEX "Experience_lastActivityAt_idx" ON "Experience"("lastActivityAt");
