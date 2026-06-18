-- Add booking reference (backfill existing rows)
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "reference" TEXT;

UPDATE "bookings"
SET "reference" = 'BK-' || UPPER(SUBSTRING(REPLACE(id::text, '-', '') FROM 1 FOR 8))
WHERE "reference" IS NULL;

ALTER TABLE "bookings" ALTER COLUMN "reference" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "bookings_reference_key" ON "bookings"("reference");

-- Optional cancel reason on status history
ALTER TABLE "booking_status_history" ADD COLUMN IF NOT EXISTS "reason" TEXT;
