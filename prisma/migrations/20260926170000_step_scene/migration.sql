-- Scene direction per step (premium recipient experience, 2026-09-26): layout, motion, music
-- level, reaction and climax. NULL keeps the classic card, so every existing and published
-- step plays exactly as before. Adding a nullable column changes no rows.
ALTER TABLE "Step" ADD COLUMN "scene" JSONB;
