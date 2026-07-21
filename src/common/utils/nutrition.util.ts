import { ActivityLevel, FitnessGoal, MetabolicFormula } from '@prisma/client';
import { roundToNearest10 } from './date.util';

export const FORMULA_VERSION = 'mifflin_st_jeor_v1';
/** v1 = plain MET; v2 = intensity / pace / optional HR */
export const ACTIVITY_FORMULA_VERSION = 'met_kcal_v2';

export type ActivityIntensity = 'low' | 'moderate' | 'high';

const INTENSITY_FACTOR: Record<ActivityIntensity, number> = {
  low: 0.85,
  moderate: 1.0,
  high: 1.15,
};

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

export function clampMet(met: number): number {
  return Math.min(18, Math.max(1, Math.round(met * 100) / 100));
}

export function intensityFactor(intensity: ActivityIntensity = 'moderate'): number {
  return INTENSITY_FACTOR[intensity] ?? 1;
}

/**
 * Resolve effective MET.
 * Priority: override → pace table (distance) → defaultMet × intensity → HR estimate flag.
 */
export function resolveActivityMet(input: {
  defaultMet?: number | null;
  metOverride?: number | null;
  intensity?: ActivityIntensity | null;
  /** from pace table when distance known */
  paceMet?: number | null;
  /** HR-based MET equivalent when preferred */
  hrMet?: number | null;
  preferHr?: boolean;
}): { met: number; source: 'override' | 'pace' | 'intensity' | 'hr' | 'default' } {
  if (input.metOverride != null && input.metOverride > 0) {
    return { met: clampMet(input.metOverride), source: 'override' };
  }
  if (input.preferHr && input.hrMet != null && input.hrMet > 0) {
    return { met: clampMet(input.hrMet), source: 'hr' };
  }
  if (input.paceMet != null && input.paceMet > 0) {
    const base = input.paceMet;
    // light intensity trim when pace already known
    const factor =
      input.intensity === 'low' ? 0.95 : input.intensity === 'high' ? 1.05 : 1;
    return { met: clampMet(base * factor), source: 'pace' };
  }
  const base = Number(input.defaultMet) || 4;
  const factor = intensityFactor(input.intensity ?? 'moderate');
  return { met: clampMet(base * factor), source: input.defaultMet != null ? 'intensity' : 'default' };
}

/**
 * Simplified Keytel-style kcal/min from HR, converted to MET-equivalent for storage.
 * kcal ≈ duration * ((-55.0969 + 0.6309*HR + 0.1988*weight + 0.2017*age) / 4.184) / 60 * 60
 * We use a compact form and back-solve MET from ACSM formula.
 */
export function metFromHeartRate(input: {
  avgHr: number;
  weightKg: number;
  ageYears: number;
  durationMinutes: number;
  sexFactor?: 'a' | 'b';
}): number | null {
  const hr = input.avgHr;
  if (!(hr >= 60 && hr <= 220) || !(input.weightKg > 0) || !(input.durationMinutes > 0)) {
    return null;
  }
  // compact estimate kcal total (gender-neutral blend)
  const kcalPerMin =
    (-55.0969 + 0.6309 * hr + 0.1988 * input.weightKg + 0.2017 * (input.ageYears || 30)) / 4.184;
  const total = Math.max(0, kcalPerMin) * input.durationMinutes;
  // invert ACSM: kcal = MET * 3.5 * kg * min / 200  →  MET = kcal * 200 / (3.5 * kg * min)
  const met = (total * 200) / (3.5 * input.weightKg * input.durationMinutes);
  if (!Number.isFinite(met) || met < 1) return null;
  return clampMet(met);
}

export function calcDeviceOrMetCalories(input: {
  met: number;
  weightKg: number;
  durationMinutes: number;
  deviceCalories?: number | null;
}): number {
  if (input.deviceCalories != null && input.deviceCalories >= 0) {
    return Math.round(input.deviceCalories);
  }
  return calcActivityCalories(input.met, input.weightKg, input.durationMinutes);
}

export function confidenceLabel(c: number): 'Tinggi' | 'Sedang' | 'Rendah' {
  if (c >= 0.8) return 'Tinggi';
  if (c >= 0.55) return 'Sedang';
  return 'Rendah';
}

/** Atwater: P×4 + C×4 + F×9 */
export function kcalFromMacros(proteinG: number, carbsG: number, fatG: number): number {
  return Math.round(Number(proteinG || 0) * 4 + Number(carbsG || 0) * 4 + Number(fatG || 0) * 9);
}

export const ATWATER_WARN_THRESHOLD = 80;

export function atwaterDelta(
  calories: number,
  proteinG: number,
  carbsG: number,
  fatG: number,
): number {
  return Math.abs(Number(calories || 0) - kcalFromMacros(proteinG, carbsG, fatG));
}

export function atwaterWarning(
  calories: number,
  proteinG: number,
  carbsG: number,
  fatG: number,
  threshold = ATWATER_WARN_THRESHOLD,
): string | null {
  const fromM = kcalFromMacros(proteinG, carbsG, fatG);
  if (fromM <= 0 && Number(calories || 0) <= 0) return null;
  const d = atwaterDelta(calories, proteinG, carbsG, fatG);
  if (d <= threshold) return null;
  return `Kalori dan makro berbeda ~${d} kkal (makro ≈ ${fromM} kkal; tercatat ${Math.round(Number(calories) || 0)} kkal).`;
}

export type CalorieBudgetMode = 'intake_only' | 'eat_back';

export function computeBudget(input: {
  mode: CalorieBudgetMode;
  intakeTarget: number;
  consumed: number;
  burned: number;
}) {
  const net = input.consumed - input.burned;
  const remainingIntake = input.intakeTarget - input.consumed;
  const remainingNet = input.intakeTarget - net;
  const remaining = input.mode === 'eat_back' ? remainingNet : remainingIntake;
  const progressBase = input.mode === 'eat_back' ? net : input.consumed;
  const progressPct =
    input.intakeTarget > 0 ? Math.round((progressBase / input.intakeTarget) * 100) : 0;
  return {
    net_calories: net,
    remaining_calories: remaining,
    remaining_intake: remainingIntake,
    remaining_net: remainingNet,
    progress_pct: progressPct,
    budget_mode: input.mode,
  };
}

/** Protein/fat g per kg by goal; carbs fill remaining kcal. */
export function computeMacroTargets(input: {
  calorieTarget: number;
  weightKg: number;
  goal: FitnessGoal | string;
}): { proteinG: number; carbsG: number; fatG: number; method: string } {
  const w = Math.max(30, Number(input.weightKg) || 70);
  const kcal = Math.max(800, Number(input.calorieTarget) || 2000);
  let pPerKg = 1.6;
  let fPerKg = 0.9;
  if (input.goal === 'lose_weight') {
    pPerKg = 1.8;
    fPerKg = 0.8;
  } else if (input.goal === 'gain_weight') {
    pPerKg = 2.0;
    fPerKg = 1.0;
  }
  const proteinG = Math.round(w * pPerKg);
  const fatG = Math.round(w * fPerKg);
  const macroKcal = proteinG * 4 + fatG * 9;
  const carbsG = Math.max(0, Math.round((kcal - macroKcal) / 4));
  return { proteinG, carbsG, fatG, method: 'g_per_kg_v1' };
}

/** Strength volume add-on (rough). Returns max(metKcal, volume-based). */
export function strengthVolumeCalories(input: {
  metCalories: number;
  sets?: number | null;
  reps?: number | null;
  loadKg?: number | null;
  bodyWeightKg: number;
  durationMinutes: number;
}): number {
  const sets = Number(input.sets) || 0;
  const reps = Number(input.reps) || 0;
  const load = Number(input.loadKg) || 0;
  if (sets <= 0 || reps <= 0) return input.metCalories;
  const volume = sets * reps * (load > 0 ? load : input.bodyWeightKg * 0.3);
  // ~0.05 kcal per kg·rep-ish scaled; clamp
  const volKcal = Math.round(volume * 0.05 + input.durationMinutes * 2);
  return Math.max(input.metCalories, Math.min(volKcal, input.metCalories * 2.5));
}
