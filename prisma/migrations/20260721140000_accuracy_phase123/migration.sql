-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "CalorieBudgetMode" AS ENUM ('intake_only', 'eat_back');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "BiologicalSex" AS ENUM ('male', 'female', 'unspecified');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- AlterTable user_settings
ALTER TABLE "user_settings"
  ADD COLUMN IF NOT EXISTS "calorie_budget_mode" "CalorieBudgetMode" NOT NULL DEFAULT 'intake_only';

-- AlterTable user_profiles
ALTER TABLE "user_profiles"
  ADD COLUMN IF NOT EXISTS "sex" "BiologicalSex" NOT NULL DEFAULT 'unspecified';

-- CreateTable weight_logs
CREATE TABLE IF NOT EXISTS "weight_logs" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "logged_at" TIMESTAMPTZ NOT NULL,
  "weight_kg" DECIMAL(6,2) NOT NULL,
  "note" TEXT,
  "source" TEXT NOT NULL DEFAULT 'manual',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "weight_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "weight_logs_user_id_logged_at_idx" ON "weight_logs"("user_id", "logged_at" DESC);

DO $$ BEGIN
  ALTER TABLE "weight_logs" ADD CONSTRAINT "weight_logs_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "app_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- CreateTable food_references
CREATE TABLE IF NOT EXISTS "food_references" (
  "id" UUID NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "portion_amount" DECIMAL(8,2) NOT NULL DEFAULT 1,
  "portion_unit" TEXT NOT NULL DEFAULT 'porsi',
  "calories" INTEGER NOT NULL,
  "protein_g" DECIMAL(8,2) NOT NULL,
  "carbs_g" DECIMAL(8,2) NOT NULL,
  "fat_g" DECIMAL(8,2) NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "source" TEXT NOT NULL DEFAULT 'catalog_id',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "food_references_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "food_references_slug_key" ON "food_references"("slug");
CREATE INDEX IF NOT EXISTS "food_references_name_idx" ON "food_references"("name");
