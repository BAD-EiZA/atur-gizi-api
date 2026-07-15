import { ActivityLevel, FitnessGoal, MetabolicFormula } from '@prisma/client';
import { roundToNearest10 } from './date.util';

export const FORMULA_VERSION = 'mifflin_st_jeor_v1';
export const ACTIVITY_FORMULA_VERSION = 'met_kcal_v1';

const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  high: 1.725,
  very_high: 1.9,
};

export function calcBmr(
  formula: MetabolicFormula,
  weightKg: number,
  heightCm: number,
  ageYears: number,
): number | null {
  if (formula === 'manual') return null;
  const base = 10 * weightKg + 6.25 * heightCm - 5 * ageYears;
  if (formula === 'mifflin_a') return base + 5;
  return base - 161;
}

export function calcTdee(bmr: number, level: ActivityLevel): number {
  return bmr * ACTIVITY_FACTORS[level];
}

export function applyGoal(
  tdee: number,
  goal: FitnessGoal,
  targetRatePct?: number | null,
): number {
  if (goal === 'manual') return tdee;
  if (goal === 'maintain') return tdee;
  if (goal === 'lose_weight') {
    const pct = targetRatePct != null ? Math.min(20, Math.max(10, targetRatePct)) : 15;
    return tdee * (1 - pct / 100);
  }
  if (goal === 'gain_weight') {
    const pct = targetRatePct != null ? Math.min(15, Math.max(5, targetRatePct)) : 10;
    return tdee * (1 + pct / 100);
  }
  return tdee;
}

export function computeTarget(input: {
  formula: MetabolicFormula;
  weightKg: number;
  heightCm: number;
  ageYears: number;
  activityLevel: ActivityLevel | null;
  goal: FitnessGoal;
  targetRatePct?: number | null;
  manualTarget?: number | null;
}) {
  if (input.goal === 'manual' || input.formula === 'manual') {
    const calorieTarget = roundToNearest10(input.manualTarget ?? 2000);
    return {
      bmrKcal: null as number | null,
      tdeeKcal: null as number | null,
      calorieTarget,
      calculationMethod: 'manual',
      formulaVersion: FORMULA_VERSION,
      calculationInputs: { ...input },
    };
  }
  if (!input.activityLevel) {
    throw new Error('activity_level_required');
  }
  const bmr = calcBmr(input.formula, input.weightKg, input.heightCm, input.ageYears);
  if (bmr == null) throw new Error('bmr_failed');
  const tdee = calcTdee(bmr, input.activityLevel);
  const adjusted = applyGoal(tdee, input.goal, input.targetRatePct);
  return {
    bmrKcal: Math.round(bmr),
    tdeeKcal: Math.round(tdee),
    calorieTarget: roundToNearest10(adjusted),
    calculationMethod: FORMULA_VERSION,
    formulaVersion: FORMULA_VERSION,
    calculationInputs: {
      formula: input.formula,
      weightKg: input.weightKg,
      heightCm: input.heightCm,
      ageYears: input.ageYears,
      activityLevel: input.activityLevel,
      goal: input.goal,
      targetRatePct: input.targetRatePct ?? null,
      activityFactor: ACTIVITY_FACTORS[input.activityLevel],
    },
  };
}

export function calcActivityCalories(
  met: number,
  weightKg: number,
  durationMinutes: number,
): number {
  return Math.round((met * 3.5 * weightKg * durationMinutes) / 200);
}

export function confidenceLabel(c: number): 'Tinggi' | 'Sedang' | 'Rendah' {
  if (c >= 0.8) return 'Tinggi';
  if (c >= 0.55) return 'Sedang';
  return 'Rendah';
}
