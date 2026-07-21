-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "ActivitySource" AS ENUM ('manual', 'estimate', 'device');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AlterTable
ALTER TABLE "activity_logs"
  ADD COLUMN IF NOT EXISTS "distance_m" DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS "rpe" INTEGER,
  ADD COLUMN IF NOT EXISTS "avg_hr" INTEGER,
  ADD COLUMN IF NOT EXISTS "sets" INTEGER,
  ADD COLUMN IF NOT EXISTS "reps" INTEGER,
  ADD COLUMN IF NOT EXISTS "load_kg" DECIMAL(6,2),
  ADD COLUMN IF NOT EXISTS "source" "ActivitySource" NOT NULL DEFAULT 'estimate',
  ADD COLUMN IF NOT EXISTS "device_calories" INTEGER,
  ADD COLUMN IF NOT EXISTS "met_source" TEXT;
