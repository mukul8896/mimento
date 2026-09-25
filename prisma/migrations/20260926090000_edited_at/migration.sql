-- An unfinished surprise only counts once the creator has changed something (2026-09-26).
-- Opening a template and leaving it untouched no longer leaves a draft behind.
ALTER TABLE "Experience" ADD COLUMN "editedAt" TIMESTAMPTZ(3);

-- Published surprises were edited by definition; drafts whose content was ever saved were too
-- (the draft revision starts at 1 and every save increments it).
UPDATE "Experience" SET "editedAt" = coalesce("publishedAt", "updatedAt") WHERE "status" <> 'DRAFT';
UPDATE "Experience" e SET "editedAt" = e."updatedAt"
FROM "ExperienceVersion" d
WHERE d."experienceId" = e."id" AND d."state" = 'DRAFT' AND d."revision" > 1
  AND e."status" = 'DRAFT';
