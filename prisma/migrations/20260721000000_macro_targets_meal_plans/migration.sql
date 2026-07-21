-- AlterTable
ALTER TABLE "daily_targets" ADD COLUMN IF NOT EXISTS "protein_target_g" DECIMAL(8,2),
ADD COLUMN IF NOT EXISTS "carbs_target_g" DECIMAL(8,2),
ADD COLUMN IF NOT EXISTS "fat_target_g" DECIMAL(8,2);

-- AlterTable
ALTER TABLE "meal_plans" ADD COLUMN IF NOT EXISTS "protein_g" DECIMAL(8,2),
ADD COLUMN IF NOT EXISTS "carbs_g" DECIMAL(8,2),
ADD COLUMN IF NOT EXISTS "fat_g" DECIMAL(8,2);
