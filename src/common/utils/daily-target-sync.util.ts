import type { Prisma } from '@prisma/client';

type Tx = Prisma.TransactionClient;

/** Close open DailyTarget rows without creating invalid effective ranges. */
export async function closeOpenDailyTargets(
  tx: Tx,
  userId: string,
  effectiveOn: Date,
  opts?: { onlyNutritionGoalId?: string; onlyMethodPrefix?: string },
) {
  const open = await tx.dailyTarget.findMany({
    where: { userId, effectiveTo: null },
    orderBy: { effectiveFrom: 'desc' },
  });

  for (const row of open) {
    if (opts?.onlyNutritionGoalId) {
      const inputs = row.calculationInputs as { nutrition_goal_id?: string };
      if (inputs?.nutrition_goal_id !== opts.onlyNutritionGoalId) continue;
    }
    if (opts?.onlyMethodPrefix) {
      if (!row.calculationMethod.startsWith(opts.onlyMethodPrefix)) continue;
    }

    const from = row.effectiveFrom;
    // Same-day open target: close on same day (valid CHECK: to >= from)
    // Older open target: close day before new effective date
    let effectiveTo = new Date(effectiveOn);
    if (from.getTime() < effectiveOn.getTime()) {
      effectiveTo = new Date(effectiveOn);
      effectiveTo.setUTCDate(effectiveTo.getUTCDate() - 1);
      if (effectiveTo.getTime() < from.getTime()) {
        effectiveTo = new Date(from);
      }
    } else {
      effectiveTo = new Date(from);
    }

    await tx.dailyTarget.update({
      where: { id: row.id },
      data: { effectiveTo },
    });
  }
}

export async function createDailyTargetFromNutritionGoal(
  tx: Tx,
  input: {
    userId: string;
    effectiveFrom: Date;
    goalId: string;
    fitnessGoal: 'lose_weight' | 'maintain' | 'gain_weight' | 'manual';
    reeKcalPerDay: number | null;
    tdeeKcalPerDay: number | null;
    targetCaloriesPerDay: number;
    formulaVersions: unknown;
    rulesetVersions: unknown;
  },
) {
  await closeOpenDailyTargets(tx, input.userId, input.effectiveFrom);
  return tx.dailyTarget.create({
    data: {
      userId: input.userId,
      effectiveFrom: input.effectiveFrom,
      bmrKcal:
        input.reeKcalPerDay != null
          ? Math.round(Number(input.reeKcalPerDay))
          : null,
      tdeeKcal:
        input.tdeeKcalPerDay != null
          ? Math.round(Number(input.tdeeKcalPerDay))
          : null,
      calorieTarget: Math.round(Number(input.targetCaloriesPerDay)),
      goal: input.fitnessGoal,
      calculationMethod: 'nutrition_v2_goal',
      calculationInputs: {
        nutrition_goal_id: input.goalId,
        formula_versions: input.formulaVersions,
        ruleset_versions: input.rulesetVersions,
      } as Prisma.InputJsonValue,
    },
  });
}
