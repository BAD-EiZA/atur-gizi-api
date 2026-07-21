-- FoodReference
ALTER TABLE "food_references"
  ADD COLUMN IF NOT EXISTS "ref_grams" DECIMAL(8,2),
  ADD COLUMN IF NOT EXISTS "calories_per_100g" INTEGER;

-- Barcode dual basis
ALTER TABLE "barcode_products"
  ADD COLUMN IF NOT EXISTS "nutrient_basis" TEXT,
  ADD COLUMN IF NOT EXISTS "serving_quantity_g" DECIMAL(8,2),
  ADD COLUMN IF NOT EXISTS "calories_100g" INTEGER,
  ADD COLUMN IF NOT EXISTS "calories_serving" INTEGER,
  ADD COLUMN IF NOT EXISTS "protein_100g" DECIMAL(8,2),
  ADD COLUMN IF NOT EXISTS "carbs_100g" DECIMAL(8,2),
  ADD COLUMN IF NOT EXISTS "fat_100g" DECIMAL(8,2),
  ADD COLUMN IF NOT EXISTS "protein_serving" DECIMAL(8,2),
  ADD COLUMN IF NOT EXISTS "carbs_serving" DECIMAL(8,2),
  ADD COLUMN IF NOT EXISTS "fat_serving" DECIMAL(8,2),
  ADD COLUMN IF NOT EXISTS "fetched_at" TIMESTAMPTZ;

-- AiPortionBias
CREATE TABLE IF NOT EXISTS "ai_portion_biases" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "food_key" TEXT NOT NULL,
  "sample_count" INTEGER NOT NULL DEFAULT 0,
  "median_kcal_ratio" DECIMAL(6,3) NOT NULL,
  "median_amount_ratio" DECIMAL(6,3),
  "updated_at" TIMESTAMPTZ NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_portion_biases_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ai_portion_biases_user_id_food_key_key" ON "ai_portion_biases"("user_id", "food_key");
CREATE INDEX IF NOT EXISTS "ai_portion_biases_user_id_idx" ON "ai_portion_biases"("user_id");
DO $$ BEGIN
  ALTER TABLE "ai_portion_biases" ADD CONSTRAINT "ai_portion_biases_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "app_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- UserEnergyState
CREATE TABLE IF NOT EXISTS "user_energy_states" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "adaptive_tdee_kcal" INTEGER,
  "suggested_target" INTEGER,
  "adjustment_kcal" INTEGER,
  "method" TEXT DEFAULT 'weight_trend_v1',
  "window_days" INTEGER,
  "avg_intake_kcal" INTEGER,
  "weight_slope_kg_wk" DECIMAL(6,3),
  "inputs" JSONB,
  "updated_at" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "user_energy_states_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "user_energy_states_user_id_key" ON "user_energy_states"("user_id");
DO $$ BEGIN
  ALTER TABLE "user_energy_states" ADD CONSTRAINT "user_energy_states_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "app_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
