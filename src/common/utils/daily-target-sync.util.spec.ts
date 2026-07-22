/* eslint-disable @typescript-eslint/require-await */
import {
  closeOpenDailyTargets,
  createDailyTargetFromNutritionGoal,
} from './daily-target-sync.util';

describe('closeOpenDailyTargets', () => {
  it('closes older open target on previous day', async () => {
    const updates: Array<{ id: string; effectiveTo: Date }> = [];
    const from = new Date('2026-07-01T00:00:00.000Z');
    const today = new Date('2026-07-22T00:00:00.000Z');
    const tx = {
      dailyTarget: {
        findMany: async () => [
          {
            id: 't1',
            effectiveFrom: from,
            calculationMethod: 'mifflin_st_jeor_v1',
            calculationInputs: {},
          },
        ],
        update: async ({
          where,
          data,
        }: {
          where: { id: string };
          data: { effectiveTo: Date };
        }) => {
          updates.push({ id: where.id, effectiveTo: data.effectiveTo });
          return {};
        },
      },
    };

    await closeOpenDailyTargets(tx as never, 'u1', today);
    expect(updates).toHaveLength(1);
    expect(updates[0].effectiveTo.toISOString().slice(0, 10)).toBe(
      '2026-07-21',
    );
  });

  it('same-day open target closes on same day', async () => {
    const updates: Array<{ effectiveTo: Date }> = [];
    const today = new Date('2026-07-22T00:00:00.000Z');
    const tx = {
      dailyTarget: {
        findMany: async () => [
          {
            id: 't1',
            effectiveFrom: today,
            calculationMethod: 'nutrition_v2_goal',
            calculationInputs: { nutrition_goal_id: 'g1' },
          },
        ],
        update: async ({ data }: { data: { effectiveTo: Date } }) => {
          updates.push({ effectiveTo: data.effectiveTo });
          return {};
        },
      },
    };

    await closeOpenDailyTargets(tx as never, 'u1', today);
    expect(updates[0]!.effectiveTo.toISOString().slice(0, 10)).toBe(
      '2026-07-22',
    );
  });
});

describe('createDailyTargetFromNutritionGoal', () => {
  it('writes protein carbs fat targets from calorie goal', async () => {
    let created: Record<string, unknown> | null = null;
    const today = new Date('2026-07-22T00:00:00.000Z');
    const tx = {
      dailyTarget: {
        findMany: async () => [],
        create: async ({ data }: { data: Record<string, unknown> }) => {
          created = data;
          return data;
        },
      },
    };

    await createDailyTargetFromNutritionGoal(tx as never, {
      userId: 'u1',
      effectiveFrom: today,
      goalId: 'g1',
      fitnessGoal: 'lose_weight',
      reeKcalPerDay: 1400,
      tdeeKcalPerDay: 2000,
      targetCaloriesPerDay: 1700,
      weightKg: 70,
      formulaVersions: {},
      rulesetVersions: {},
    });

    expect(created).not.toBeNull();
    expect(created!.calorieTarget).toBe(1700);
    expect(created!.proteinTargetG).toBe(Math.round(70 * 1.8));
    expect(created!.fatTargetG).toBe(Math.round(70 * 0.8));
    expect(Number(created!.carbsTargetG)).toBeGreaterThan(0);
    const inputs = created!.calculationInputs as { macros_method?: string };
    expect(inputs.macros_method).toBe('g_per_kg_v1');
  });
});
