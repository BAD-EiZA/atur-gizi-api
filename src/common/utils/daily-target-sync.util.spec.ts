/* eslint-disable @typescript-eslint/require-await */
import { closeOpenDailyTargets } from './daily-target-sync.util';

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
    expect(updates[0].effectiveTo.toISOString().slice(0, 10)).toBe(
      '2026-07-22',
    );
  });
});
