import { calcActivityCalories, calcBmr, computeTarget } from './nutrition.util';

describe('nutrition util', () => {
  it('mifflin A/B', () => {
    expect(calcBmr('mifflin_a', 70, 175, 30)).toBeCloseTo(1648.75, 1);
    expect(calcBmr('mifflin_b', 70, 175, 30)).toBeCloseTo(1482.75, 1);
  });

  it('target lose weight rounds to 10', () => {
    const r = computeTarget({
      formula: 'mifflin_a',
      weightKg: 70,
      heightCm: 175,
      ageYears: 30,
      activityLevel: 'moderate',
      goal: 'lose_weight',
      targetRatePct: 15,
    });
    expect(r.calorieTarget % 10).toBe(0);
    expect(r.bmrKcal).toBeGreaterThan(1000);
  });

  it('activity MET formula', () => {
    // MET 8, 70kg, 30min => 8*3.5*70/200*30 = 294
    expect(calcActivityCalories(8, 70, 30)).toBe(294);
  });
});
