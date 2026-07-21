import {
  atwaterDelta,
  calcActivityCalories,
  calcBmr,
  computeBudget,
  computeMacroTargets,
  computeTarget,
  intensityFactor,
  kcalFromMacros,
  metFromHeartRate,
  resolveActivityMet,
  strengthVolumeCalories,
} from './nutrition.util';
import { metFromSpeedKmh, speedKmhFromDistance } from './activity-met-tables';

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
    expect(calcActivityCalories(8, 70, 30)).toBe(294);
  });

  it('intensity scales MET', () => {
    expect(intensityFactor('low')).toBe(0.85);
    expect(intensityFactor('high')).toBe(1.15);
    const low = resolveActivityMet({ defaultMet: 10, intensity: 'low' });
    const high = resolveActivityMet({ defaultMet: 10, intensity: 'high' });
    expect(low.met).toBe(8.5);
    expect(high.met).toBe(11.5);
    expect(high.met).toBeGreaterThan(low.met);
  });

  it('override beats intensity', () => {
    const r = resolveActivityMet({ defaultMet: 10, intensity: 'high', metOverride: 6 });
    expect(r.met).toBe(6);
    expect(r.source).toBe('override');
  });

  it('pace from distance', () => {
    // 5 km in 30 min = 10 km/h → running band ≤11.3 → MET 11.0
    const speed = speedKmhFromDistance(5000, 30);
    expect(speed).toBeCloseTo(10, 1);
    expect(metFromSpeedKmh('running', speed!)).toBe(11.0);
    expect(metFromSpeedKmh('running', 9)).toBe(9.8);
  });

  it('HR estimate returns finite MET', () => {
    const met = metFromHeartRate({ avgHr: 150, weightKg: 70, ageYears: 30, durationMinutes: 30 });
    expect(met).not.toBeNull();
    expect(met!).toBeGreaterThan(3);
    expect(met!).toBeLessThan(18);
  });

  it('atwater and budget modes', () => {
    expect(kcalFromMacros(50, 50, 50)).toBe(850);
    expect(atwaterDelta(100, 50, 50, 50)).toBeGreaterThan(80);
    const intake = computeBudget({
      mode: 'intake_only',
      intakeTarget: 2000,
      consumed: 1500,
      burned: 400,
    });
    expect(intake.remaining_calories).toBe(500);
    const eat = computeBudget({
      mode: 'eat_back',
      intakeTarget: 2000,
      consumed: 1500,
      burned: 400,
    });
    expect(eat.remaining_calories).toBe(900);
  });

  it('macro targets g/kg', () => {
    const m = computeMacroTargets({ calorieTarget: 2000, weightKg: 70, goal: 'lose_weight' });
    expect(m.proteinG).toBe(Math.round(70 * 1.8));
    expect(m.fatG + m.carbsG + m.proteinG).toBeGreaterThan(0);
  });

  it('strength volume can raise kcal', () => {
    const base = 200;
    const raised = strengthVolumeCalories({
      metCalories: base,
      sets: 5,
      reps: 5,
      loadKg: 80,
      bodyWeightKg: 70,
      durationMinutes: 40,
    });
    expect(raised).toBeGreaterThanOrEqual(base);
  });
});
