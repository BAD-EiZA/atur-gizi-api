-- CreateTable
CREATE TABLE "meal_memories" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "alias" TEXT NOT NULL,
    "resolved_name" TEXT NOT NULL,
    "portion_amount" DECIMAL(10,2),
    "portion_unit" TEXT,
    "calories" INTEGER,
    "protein_g" DECIMAL(8,2),
    "carbs_g" DECIMAL(8,2),
    "fat_g" DECIMAL(8,2),
    "notes" TEXT,
    "use_count" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "meal_memories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "meal_memories_user_id_updated_at_idx" ON "meal_memories"("user_id", "updated_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "meal_memories_user_id_alias_key" ON "meal_memories"("user_id", "alias");

-- AddForeignKey
ALTER TABLE "meal_memories" ADD CONSTRAINT "meal_memories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
