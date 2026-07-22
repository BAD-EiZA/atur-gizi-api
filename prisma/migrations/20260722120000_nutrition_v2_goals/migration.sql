-- Nutrition v2 goals foundation

DO $$ BEGIN
  CREATE TYPE "NutritionGoalType" AS ENUM ('lose_weight', 'maintain', 'gain_weight', 'manual');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "NutritionGoalMethod" AS ENUM ('weekly_rate', 'target_date', 'maintenance', 'manual');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "NutritionGoalStatus" AS ENUM ('draft', 'active', 'eligible_for_completion', 'completed', 'cancelled', 'replaced');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "NutritionGoalSource" AS ENUM ('automatic', 'manual_adult', 'manual_adolescent');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "NutritionValueSource" AS ENUM ('estimated', 'manual');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ScreeningAnswer" AS ENUM ('yes', 'no', 'unknown', 'prefer_not_to_say');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "NutritionPreviewStatus" AS ENUM ('unused', 'consumed', 'invalidated', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "nutrition_safety_screenings" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "is_pregnant" "ScreeningAnswer" NOT NULL,
  "is_breastfeeding" "ScreeningAnswer" NOT NULL,
  "has_kidney_disease" "ScreeningAnswer" NOT NULL,
  "has_liver_disease" "ScreeningAnswer" NOT NULL,
  "has_heart_failure_or_fluid_retention" "ScreeningAnswer" NOT NULL,
  "uses_hypoglycemia_risk_medication" "ScreeningAnswer" NOT NULL,
  "has_eating_disorder_history" "ScreeningAnswer" NOT NULL,
  "consent_version" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "nutrition_safety_screenings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "nutrition_safety_screenings_user_id_key"
  ON "nutrition_safety_screenings"("user_id");

CREATE TABLE IF NOT EXISTS "nutrition_previews" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "status" "NutritionPreviewStatus" NOT NULL DEFAULT 'unused',
  "input_hash" TEXT NOT NULL,
  "screening_record_id" UUID NOT NULL,
  "screening_version" INTEGER NOT NULL,
  "calculation_local_date" DATE NOT NULL,
  "timezone" TEXT NOT NULL,
  "formula_versions" JSONB NOT NULL,
  "ruleset_versions" JSONB NOT NULL,
  "warning_codes" JSONB NOT NULL,
  "blocking_codes" JSONB NOT NULL,
  "safe_input_snapshot" JSONB NOT NULL,
  "output_snapshot" JSONB NOT NULL,
  "expires_at" TIMESTAMPTZ NOT NULL,
  "consumed_at" TIMESTAMPTZ,
  "invalidated_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "nutrition_previews_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "nutrition_previews_user_id_status_expires_at_idx"
  ON "nutrition_previews"("user_id", "status", "expires_at");

CREATE TABLE IF NOT EXISTS "nutrition_goals" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "root_goal_id" UUID NOT NULL,
  "parent_goal_id" UUID,
  "replaces_goal_id" UUID,
  "revision_number" INTEGER NOT NULL,
  "type" "NutritionGoalType" NOT NULL,
  "method" "NutritionGoalMethod" NOT NULL,
  "status" "NutritionGoalStatus" NOT NULL,
  "source" "NutritionGoalSource" NOT NULL DEFAULT 'automatic',
  "value_source" "NutritionValueSource" NOT NULL,
  "start_weight_kg" DECIMAL(6,3) NOT NULL,
  "target_weight_kg" DECIMAL(6,3),
  "weekly_change_kg" DECIMAL(6,3),
  "target_date" DATE,
  "estimated_weeks" DECIMAL(7,3),
  "bmi" DECIMAL(7,4),
  "target_bmi" DECIMAL(7,4),
  "ree_kcal_per_day" DECIMAL(8,2),
  "tdee_kcal_per_day" DECIMAL(8,2),
  "target_calories_per_day" DECIMAL(8,2),
  "activity_level" "ActivityLevel",
  "activity_multiplier" DECIMAL(6,4),
  "feasibility" TEXT,
  "formula_versions" JSONB NOT NULL,
  "ruleset_versions" JSONB NOT NULL,
  "warning_codes" JSONB NOT NULL,
  "blocking_codes" JSONB NOT NULL,
  "automatic_plan_allowed" BOOLEAN NOT NULL,
  "screening_record_id" UUID,
  "screening_version" INTEGER,
  "profile_hash" TEXT,
  "safety_evaluated_at" TIMESTAMPTZ,
  "safe_input_snapshot" JSONB NOT NULL,
  "output_snapshot" JSONB NOT NULL,
  "activated_at" TIMESTAMPTZ,
  "completion_eligible_at" TIMESTAMPTZ,
  "completed_at" TIMESTAMPTZ,
  "cancelled_at" TIMESTAMPTZ,
  "replaced_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "nutrition_goals_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "nutrition_goals_root_goal_id_revision_number_key"
  ON "nutrition_goals"("root_goal_id", "revision_number");
CREATE INDEX IF NOT EXISTS "nutrition_goals_user_id_status_idx"
  ON "nutrition_goals"("user_id", "status");
CREATE INDEX IF NOT EXISTS "nutrition_goals_root_goal_id_status_idx"
  ON "nutrition_goals"("root_goal_id", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "nutrition_goals_one_running_per_user"
  ON "nutrition_goals"("user_id")
  WHERE "status" IN ('active', 'eligible_for_completion');

CREATE TABLE IF NOT EXISTS "nutrition_goal_acceptances" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "goal_id" UUID NOT NULL,
  "accepted_warning_codes" JSONB NOT NULL,
  "aggressive_risk_accepted" BOOLEAN NOT NULL DEFAULT false,
  "confirmation_text_version" TEXT NOT NULL,
  "ruleset_versions" JSONB NOT NULL,
  "accepted_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "nutrition_goal_acceptances_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "nutrition_goal_acceptances_goal_id_accepted_at_idx"
  ON "nutrition_goal_acceptances"("goal_id", "accepted_at" DESC);

DO $$ BEGIN
  ALTER TABLE "nutrition_safety_screenings"
    ADD CONSTRAINT "nutrition_safety_screenings_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "app_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "nutrition_previews"
    ADD CONSTRAINT "nutrition_previews_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "app_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "nutrition_goals"
    ADD CONSTRAINT "nutrition_goals_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "app_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "nutrition_goal_acceptances"
    ADD CONSTRAINT "nutrition_goal_acceptances_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "app_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "nutrition_goal_acceptances"
    ADD CONSTRAINT "nutrition_goal_acceptances_goal_id_fkey"
    FOREIGN KEY ("goal_id") REFERENCES "nutrition_goals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
