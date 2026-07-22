-- Atomic idempotency reservation fields
ALTER TABLE "idempotency_keys"
  ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'completed',
  ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "idempotency_keys"
SET "status" = 'completed'
WHERE "status" IS NULL OR "status" = '';
