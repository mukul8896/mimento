-- Templates are personalised, PRO is for building (template personalization & PRO, 2026-09-25).
-- A template-based experience keeps the template's structure until the creator chooses
-- "Customize with PRO". New experiences get their mode on creation; the default covers blank ones.
CREATE TYPE "ExperienceMode" AS ENUM ('TEMPLATE', 'CUSTOM');
ALTER TABLE "Experience" ADD COLUMN "mode" "ExperienceMode" NOT NULL DEFAULT 'CUSTOM';

-- Existing template drafts whose steps still match the template (same step types in order, no
-- branching) become TEMPLATE; ones that were already restructured stay CUSTOM, which is the tier
-- they already required (PRO).
UPDATE "Experience" e
SET "mode" = 'TEMPLATE'
FROM "Template" t, "ExperienceVersion" d
WHERE e."templateKey" = t."key"
  AND d."experienceId" = e."id"
  AND d."state" = 'DRAFT'
  AND (
    SELECT coalesce(array_agg(s."type"::text ORDER BY s."position"), '{}')
    FROM "Step" s WHERE s."versionId" = d."id"
  ) = (
    SELECT coalesce(array_agg(x."value"->>'type' ORDER BY x."ordinality"), '{}')
    FROM jsonb_array_elements(t."content"->'steps') WITH ORDINALITY AS x("value", "ordinality")
  )
  AND NOT EXISTS (
    SELECT 1 FROM "Step" s
    WHERE s."versionId" = d."id"
      AND s."routing" IS NOT NULL
      AND (
        jsonb_array_length(coalesce(s."routing"->'rules', '[]'::jsonb)) > 0
        OR coalesce(s."routing"->'otherwise', 'null'::jsonb) <> 'null'::jsonb
      )
  );

-- Checkout started from Publish publishes the experience as soon as the payment is confirmed.
ALTER TABLE "PaymentOrder" ADD COLUMN "publishOnPaid" BOOLEAN NOT NULL DEFAULT false;
