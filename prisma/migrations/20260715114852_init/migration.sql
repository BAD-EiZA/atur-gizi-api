-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('active', 'deletion_requested', 'deleted');

-- CreateEnum
CREATE TYPE "UnitSystem" AS ENUM ('metric', 'imperial');

-- CreateEnum
CREATE TYPE "MetabolicFormula" AS ENUM ('mifflin_a', 'mifflin_b', 'manual');

-- CreateEnum
CREATE TYPE "ActivityLevel" AS ENUM ('sedentary', 'light', 'moderate', 'high', 'very_high');

-- CreateEnum
CREATE TYPE "FitnessGoal" AS ENUM ('lose_weight', 'maintain', 'gain_weight', 'manual');

-- CreateEnum
CREATE TYPE "MealType" AS ENUM ('breakfast', 'lunch', 'dinner', 'snack', 'other');

-- CreateEnum
CREATE TYPE "FoodLogSource" AS ENUM ('manual', 'ai_confirmed', 'import');

-- CreateEnum
CREATE TYPE "AiAnalysisStatus" AS ENUM ('uploaded', 'processing', 'succeeded', 'needs_review', 'confirmed', 'failed', 'cancelled');

-- CreateEnum
CREATE TYPE "Intensity" AS ENUM ('low', 'moderate', 'high');

-- CreateTable
CREATE TABLE "app_users" (
    "id" UUID NOT NULL,
    "kinde_user_id" TEXT NOT NULL,
    "email" TEXT,
    "display_name" TEXT,
    "status" "UserStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "app_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_profiles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "date_of_birth" DATE,
    "height_cm" DECIMAL(6,2),
    "current_weight_kg" DECIMAL(6,2),
    "metabolic_formula" "MetabolicFormula" NOT NULL DEFAULT 'manual',
    "activity_level" "ActivityLevel",
    "fitness_goal" "FitnessGoal",
    "target_rate" DECIMAL(5,2),
    "formula_version" TEXT,
    "onboarding_completed" BOOLEAN NOT NULL DEFAULT false,
    "estimates_accepted" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_settings" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Jakarta',
    "unit_system" "UnitSystem" NOT NULL DEFAULT 'metric',
    "locale" TEXT NOT NULL DEFAULT 'id-ID',
    "retain_food_photos" BOOLEAN NOT NULL DEFAULT false,
    "analytics_consent" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "user_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_targets" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "bmr_kcal" INTEGER,
    "tdee_kcal" INTEGER,
    "calorie_target" INTEGER NOT NULL,
    "goal" "FitnessGoal" NOT NULL,
    "calculation_method" TEXT NOT NULL,
    "calculation_inputs" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_targets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "food_logs" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "log_date" DATE NOT NULL,
    "consumed_at" TIMESTAMPTZ NOT NULL,
    "meal_type" "MealType" NOT NULL,
    "title" TEXT NOT NULL,
    "total_calories" INTEGER NOT NULL,
    "protein_g" DECIMAL(8,2),
    "carbs_g" DECIMAL(8,2),
    "fat_g" DECIMAL(8,2),
    "source" "FoodLogSource" NOT NULL DEFAULT 'manual',
    "cloudinary_public_id" TEXT,
    "media_delivery_type" TEXT,
    "ai_analysis_id" UUID,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "food_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "food_items" (
    "id" UUID NOT NULL,
    "food_log_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "portion_amount" DECIMAL(10,2) NOT NULL,
    "portion_unit" TEXT NOT NULL,
    "calories" INTEGER NOT NULL,
    "protein_g" DECIMAL(8,2),
    "carbs_g" DECIMAL(8,2),
    "fat_g" DECIMAL(8,2),
    "fiber_g" DECIMAL(8,2),
    "ai_confidence" DECIMAL(4,3),
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "food_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_types" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "default_met" DECIMAL(5,2) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "source_version" TEXT NOT NULL DEFAULT 'met_compendium_v1',

    CONSTRAINT "activity_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_logs" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "activity_type_id" UUID,
    "custom_name" TEXT,
    "log_date" DATE NOT NULL,
    "started_at" TIMESTAMPTZ,
    "duration_minutes" INTEGER NOT NULL,
    "intensity" "Intensity" NOT NULL DEFAULT 'moderate',
    "met_value" DECIMAL(5,2) NOT NULL,
    "weight_snapshot_kg" DECIMAL(6,2) NOT NULL,
    "calculated_calories" INTEGER NOT NULL,
    "calories_burned" INTEGER NOT NULL,
    "formula_version" TEXT NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_analysis_runs" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'google',
    "model" TEXT NOT NULL,
    "prompt_version" TEXT NOT NULL,
    "schema_version" TEXT NOT NULL,
    "cloudinary_public_id" TEXT NOT NULL,
    "media_delivery_type" TEXT,
    "media_version" TEXT,
    "media_format" TEXT,
    "media_bytes" INTEGER,
    "status" "AiAnalysisStatus" NOT NULL DEFAULT 'uploaded',
    "latency_ms" INTEGER,
    "overall_confidence" DECIMAL(4,3),
    "normalized_output" JSONB,
    "failure_code" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmed_at" TIMESTAMPTZ,

    CONSTRAINT "ai_analysis_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_usage_daily" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "usage_date" DATE NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ai_usage_daily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_keys" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "route" TEXT NOT NULL,
    "request_hash" TEXT NOT NULL,
    "status_code" INTEGER NOT NULL,
    "response_body" JSONB NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "app_users_kinde_user_id_key" ON "app_users"("kinde_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_profiles_user_id_key" ON "user_profiles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_settings_user_id_key" ON "user_settings"("user_id");

-- CreateIndex
CREATE INDEX "daily_targets_user_id_effective_from_idx" ON "daily_targets"("user_id", "effective_from" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "food_logs_ai_analysis_id_key" ON "food_logs"("ai_analysis_id");

-- CreateIndex
CREATE INDEX "food_logs_user_id_log_date_consumed_at_idx" ON "food_logs"("user_id", "log_date" DESC, "consumed_at" DESC);

-- CreateIndex
CREATE INDEX "food_logs_user_id_log_date_deleted_at_idx" ON "food_logs"("user_id", "log_date", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "activity_types_slug_key" ON "activity_types"("slug");

-- CreateIndex
CREATE INDEX "activity_logs_user_id_log_date_idx" ON "activity_logs"("user_id", "log_date" DESC);

-- CreateIndex
CREATE INDEX "activity_logs_user_id_log_date_deleted_at_idx" ON "activity_logs"("user_id", "log_date", "deleted_at");

-- CreateIndex
CREATE INDEX "ai_analysis_runs_user_id_created_at_idx" ON "ai_analysis_runs"("user_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "ai_usage_daily_user_id_usage_date_key" ON "ai_usage_daily"("user_id", "usage_date");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_keys_user_id_key_route_key" ON "idempotency_keys"("user_id", "key", "route");

-- AddForeignKey
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_targets" ADD CONSTRAINT "daily_targets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "food_logs" ADD CONSTRAINT "food_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "food_logs" ADD CONSTRAINT "food_logs_ai_analysis_id_fkey" FOREIGN KEY ("ai_analysis_id") REFERENCES "ai_analysis_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "food_items" ADD CONSTRAINT "food_items_food_log_id_fkey" FOREIGN KEY ("food_log_id") REFERENCES "food_logs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_activity_type_id_fkey" FOREIGN KEY ("activity_type_id") REFERENCES "activity_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_analysis_runs" ADD CONSTRAINT "ai_analysis_runs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_usage_daily" ADD CONSTRAINT "ai_usage_daily_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idempotency_keys" ADD CONSTRAINT "idempotency_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
