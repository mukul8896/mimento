-- Branching (Phase 2c). Each step may carry routing: ordered rules (answer, quiz score, date,
-- completed step) and a fallback target. NULL keeps the Phase 1 behaviour: go to the next step.
-- Published steps stay immutable (existing triggers); adding a nullable column changes no rows.
ALTER TABLE "Step" ADD COLUMN "routing" JSONB;
