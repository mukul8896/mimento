-- Hand-written integrity rules that the Prisma schema language cannot express.

-- Exactly one mutable draft (number 0) per experience; published versions are numbered 1..n.
ALTER TABLE "ExperienceVersion"
  ADD CONSTRAINT "ExperienceVersion_number_matches_state"
  CHECK (("state" = 'DRAFT' AND "number" = 0) OR ("state" = 'PUBLISHED' AND "number" >= 1));

CREATE UNIQUE INDEX "ExperienceVersion_one_draft_per_experience"
  ON "ExperienceVersion" ("experienceId") WHERE "state" = 'DRAFT';

-- Published snapshots are immutable. Deleting them stays possible so that permanently deleting
-- an experience or an account (cascade) works.
CREATE FUNCTION momentpath_forbid_published_version_update() RETURNS trigger AS $$
BEGIN
  IF OLD."state" = 'PUBLISHED' THEN
    RAISE EXCEPTION 'Published experience versions are immutable' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ExperienceVersion_immutable_when_published"
  BEFORE UPDATE ON "ExperienceVersion"
  FOR EACH ROW EXECUTE FUNCTION momentpath_forbid_published_version_update();

-- Steps of a published version cannot be updated, and cannot be deleted while their version
-- still exists (a cascade from deleting the version itself is allowed).
CREATE FUNCTION momentpath_forbid_published_step_change() RETURNS trigger AS $$
DECLARE
  version_state "VersionState";
BEGIN
  SELECT "state" INTO version_state FROM "ExperienceVersion" WHERE "id" = OLD."versionId";
  IF version_state = 'PUBLISHED' THEN
    RAISE EXCEPTION 'Steps of a published version are immutable' USING ERRCODE = 'check_violation';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "Step_immutable_when_published"
  BEFORE UPDATE OR DELETE ON "Step"
  FOR EACH ROW EXECUTE FUNCTION momentpath_forbid_published_step_change();

-- Gift rows of published versions may only change their reveal-tracking columns.
CREATE FUNCTION momentpath_restrict_published_gift_update() RETURNS trigger AS $$
DECLARE
  version_state "VersionState";
BEGIN
  SELECT "state" INTO version_state FROM "ExperienceVersion" WHERE "id" = OLD."versionId";
  IF version_state = 'PUBLISHED' AND (
       NEW."payloadEnc" IS DISTINCT FROM OLD."payloadEnc"
    OR NEW."kind" IS DISTINCT FROM OLD."kind"
    OR NEW."stepKey" IS DISTINCT FROM OLD."stepKey"
    OR NEW."mediaId" IS DISTINCT FROM OLD."mediaId"
    OR NEW."oneTimeReveal" IS DISTINCT FROM OLD."oneTimeReveal"
    OR NEW."versionId" IS DISTINCT FROM OLD."versionId") THEN
    RAISE EXCEPTION 'Published gift content is immutable' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "Gift_content_immutable_when_published"
  BEFORE UPDATE ON "Gift"
  FOR EACH ROW EXECUTE FUNCTION momentpath_restrict_published_gift_update();
