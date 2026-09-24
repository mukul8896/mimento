-- Media pipeline (Phase 2b). A background worker scans every upload with ClamAV and, when clean,
-- writes re-encoded display and thumbnail copies. Re-encoding drops all metadata (EXIF, XMP, GPS)
-- for every format, and keeps multi-megabyte originals off recipients' phones.
-- Existing READY uploads have processedAt NULL, so the worker backfills them automatically.

ALTER TABLE "MediaAsset" ADD COLUMN "displayKey" TEXT;
ALTER TABLE "MediaAsset" ADD COLUMN "thumbKey" TEXT;
ALTER TABLE "MediaAsset" ADD COLUMN "processedAt" TIMESTAMPTZ(3);

CREATE INDEX "MediaAsset_status_processedAt_idx" ON "MediaAsset"("status", "processedAt");
