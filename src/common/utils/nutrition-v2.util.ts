import { createHash } from 'crypto';
import { ActivityLevel, BiologicalSex, MetabolicFormula } from '@prisma/client';

export const NUTRITION_FORMULA_VERSIONS = {
  bmi: 'adult_bmi_v1',
  ree: 'mifflin_st_jeor_v2',
  tdee: 'tdee_activity_multiplier_v2',
  calorieGoal: 'linear_energy_adjustment_v1',
} as const;

export const NUTRITION_RULESET_VERSIONS = {
  nutritionSafety: 'nutrition_safety_v1',
  goalFeasibility: 'goal_feasibility_v1',
} as const;

export const ADULT_SUPPORTED_RANGE = {
  ageYears: { min: 20, max: 100 },
  heightCm: { min: 100, max: 250 },
  weightKg: { min: 20, max: 350 },
} as const;

export const ACTIVITY_MULTIPLIERS_V2 = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  high: 1.725,
  very_high: 1.9,
} as const satisfies Record<ActivityLevel, number>;

export type EquationSex = 'male' | 'female';

export type AdultBmiCategory =
  | 'underweight'
  | 'healthy'
  | 'overweight'
  | 'obesity_class_1'
  | 'obesity_class_2'
  | 'obesity_class_3';

export type ScreeningAnswer = 'yes' | 'no' | 'unknown' | 'prefer_not_to_say';

export type NutritionWarningCode =
  | 'TARGET_EQUALS_REE'
  | 'DEFICIT_HIGH'
  | 'SURPLUS_HIGH'
  | 'GOAL_RATE_AGGRESSIVE'
  | 'LEGACY_FORMULA_IN_USE';

export type NutritionBlockingCode =
  | 'AGE_UNSUPPORTED'
  | 'PROFILE_OUTSIDE_SUPPORTED_RANGE'
  | 'SCREENING_INCOMPLETE'
  | 'PREGNANCY'
  | 'BREASTFEEDING'
  | 'KIDNEY_CONDITION'
  | 'LIVER_CONDITION'
  | 'HEART_FAILURE_OR_FLUID_RETENTION'
  | 'HYPOGLYCEMIA_MEDICATION'
  | 'EATING_DISORDER_HISTORY'
  | 'TARGET_BMI_TOO_LOW'
  | 'TARGET_BMI_GAIN_UNSUPPORTED'
  | 'WEEKLY_RATE_TOO_HIGH'
  | 'WEEKLY_RATE_DURATION_TOO_LONG'
  | 'TARGET_DATE_TOO_FAR'
  | 'CALORIE_TARGET_BELOW_REE'
  | 'DEFICIT_TOO_HIGH'
  | 'SURPLUS_TOO_HIGH'
  | 'EQUATION_SEX_REQUIRED';

export interface NutritionSafetyScreeningAnswers {
  isPregnant: ScreeningAnswer;
  isBreastfeeding: ScreeningAnswer;
  hasKidneyDisease: ScreeningAnswer;
  hasLiverDisease: ScreeningAnswer;
  hasHeartFailureOrFluidRetention: ScreeningAnswer;
  usesHypoglycemiaRiskMedication: ScreeningAnswer;
  hasEatingDisorderHistory: ScreeningAnswer;
}

export interface NutritionDecision {
  warningCodes: NutritionWarningCode[];
  blockingCodes: NutritionBlockingCode[];
  automaticPlanAllowed: boolean;
  severity: 'none' | 'warning' | 'block';
  requiresProfessionalReview: boolean;
  rulesetVersions: typeof NUTRITION_RULESET_VERSIONS;
}

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function roundHalfUp(value: number, scale: number): number {
  if (!Number.isFinite(value)) {
    throw new Error('INVALID_NUMBER');
  }
  const factor = 10 ** scale;
  return (
    (Math.sign(value) * Math.round(Math.abs(value) * factor + Number.EPSILON)) /
    factor
  );
}

export function normalizeMetabolicFormula(
  formula: MetabolicFormula,
  sex?: BiologicalSex | EquationSex | null,
): MetabolicFormula {
  if (formula === 'manual') return formula;
  if (sex === 'male') return 'mifflin_a';
  if (sex === 'female') return 'mifflin_b';
  return formula;
}

export function equationSexFromProfile(
  sex?: BiologicalSex | EquationSex | null,
  formula?: MetabolicFormula | null,
): EquationSex | null {
  if (sex === 'male') return 'male';
  if (sex === 'female') return 'female';
  if (formula === 'mifflin_a') return 'male';
  if (formula === 'mifflin_b') return 'female';
  return null;
}

export function assertFinitePositive(name: string, value: number): void {
  if (!isFiniteNumber(value) || value <= 0) {
    throw new Error(`${name}_INVALID`);
  }
}

export function validateAdultSupportedProfile(input: {
  ageYears: number;
  heightCm: number;
  weightKg: number;
}): NutritionBlockingCode[] {
  const blocking: NutritionBlockingCode[] = [];
  if (
    !isFiniteNumber(input.ageYears) ||
    input.ageYears < ADULT_SUPPORTED_RANGE.ageYears.min ||
    input.ageYears > ADULT_SUPPORTED_RANGE.ageYears.max
  ) {
    blocking.push('AGE_UNSUPPORTED');
  }
  if (
    !isFiniteNumber(input.heightCm) ||
    input.heightCm < ADULT_SUPPORTED_RANGE.heightCm.min ||
    input.heightCm > ADULT_SUPPORTED_RANGE.heightCm.max ||
    !isFiniteNumber(input.weightKg) ||
    input.weightKg < ADULT_SUPPORTED_RANGE.weightKg.min ||
    input.weightKg > ADULT_SUPPORTED_RANGE.weightKg.max
  ) {
    blocking.push('PROFILE_OUTSIDE_SUPPORTED_RANGE');
  }
  return blocking;
}

export function canUseAdultAutomaticPlan(ageYears: number): boolean {
  return (
    isFiniteNumber(ageYears) &&
    ageYears >= ADULT_SUPPORTED_RANGE.ageYears.min &&
    ageYears <= ADULT_SUPPORTED_RANGE.ageYears.max
  );
}

export function calcBmi(weightKg: number, heightCm: number): number {
  assertFinitePositive('weightKg', weightKg);
  assertFinitePositive('heightCm', heightCm);
  const heightM = heightCm / 100;
  return weightKg / (heightM * heightM);
}

export function adultBmiCategory(bmi: number): AdultBmiCategory {
  if (!isFiniteNumber(bmi)) throw new Error('BMI_INVALID');
  if (bmi < 18.5) return 'underweight';
  if (bmi < 25) return 'healthy';
  if (bmi < 30) return 'overweight';
  if (bmi < 35) return 'obesity_class_1';
  if (bmi < 40) return 'obesity_class_2';
  return 'obesity_class_3';
}

export function healthyWeightRangeKg(heightCm: number): {
  min: number;
  max: number;
} {
  assertFinitePositive('heightCm', heightCm);
  const heightM2 = (heightCm / 100) ** 2;
  return {
    min: 18.5 * heightM2,
    max: 24.9 * heightM2,
  };
}

export function calcReeKcal(input: {
  weightKg: number;
  heightCm: number;
  ageYears: number;
  equationSex: EquationSex;
}): number {
  assertFinitePositive('weightKg', input.weightKg);
  assertFinitePositive('heightCm', input.heightCm);
  assertFinitePositive('ageYears', input.ageYears);
  const base = 10 * input.weightKg + 6.25 * input.heightCm - 5 * input.ageYears;
  return input.equationSex === 'male' ? base + 5 : base - 161;
}

export function calcTdeeKcal(
  reeKcal: number,
  activityLevel: ActivityLevel,
): number {
  if (!isFiniteNumber(reeKcal) || reeKcal <= 0) throw new Error('REE_INVALID');
  return reeKcal * ACTIVITY_MULTIPLIERS_V2[activityLevel];
}

export function evaluateScreening(
  answers?: Partial<NutritionSafetyScreeningAnswers> | null,
): NutritionBlockingCode[] {
  if (!answers) return ['SCREENING_INCOMPLETE'];
  const required: Array<keyof NutritionSafetyScreeningAnswers> = [
    'isPregnant',
    'isBreastfeeding',
    'hasKidneyDisease',
    'hasLiverDisease',
    'hasHeartFailureOrFluidRetention',
    'usesHypoglycemiaRiskMedication',
    'hasEatingDisorderHistory',
  ];
  for (const key of required) {
    const value = answers[key];
    if (value == null) return ['SCREENING_INCOMPLETE'];
    if (value === 'unknown' || value === 'prefer_not_to_say') {
      return ['SCREENING_INCOMPLETE'];
    }
  }
  const blocking: NutritionBlockingCode[] = [];
  if (answers.isPregnant === 'yes') blocking.push('PREGNANCY');
  if (answers.isBreastfeeding === 'yes') blocking.push('BREASTFEEDING');
  if (answers.hasKidneyDisease === 'yes') blocking.push('KIDNEY_CONDITION');
  if (answers.hasLiverDisease === 'yes') blocking.push('LIVER_CONDITION');
  if (answers.hasHeartFailureOrFluidRetention === 'yes') {
    blocking.push('HEART_FAILURE_OR_FLUID_RETENTION');
  }
  if (answers.usesHypoglycemiaRiskMedication === 'yes') {
    blocking.push('HYPOGLYCEMIA_MEDICATION');
  }
  if (answers.hasEatingDisorderHistory === 'yes') {
    blocking.push('EATING_DISORDER_HISTORY');
  }
  return blocking;
}

export function evaluateCalorieSafety(input: {
  reeKcal: number;
  tdeeKcal: number;
  targetKcal: number;
}): {
  warningCodes: NutritionWarningCode[];
  blockingCodes: NutritionBlockingCode[];
} {
  const warningCodes: NutritionWarningCode[] = [];
  const blockingCodes: NutritionBlockingCode[] = [];
  const { reeKcal, tdeeKcal, targetKcal } = input;
  if (![reeKcal, tdeeKcal, targetKcal].every(isFiniteNumber) || tdeeKcal <= 0) {
    blockingCodes.push('PROFILE_OUTSIDE_SUPPORTED_RANGE');
    return { warningCodes, blockingCodes };
  }
  if (targetKcal <= 0) {
    blockingCodes.push('CALORIE_TARGET_BELOW_REE');
    return { warningCodes, blockingCodes };
  }
  if (targetKcal < reeKcal) {
    blockingCodes.push('CALORIE_TARGET_BELOW_REE');
  } else if (targetKcal === reeKcal) {
    warningCodes.push('TARGET_EQUALS_REE');
  }

  if (targetKcal < tdeeKcal) {
    const deficitPercent = ((tdeeKcal - targetKcal) / tdeeKcal) * 100;
    if (deficitPercent > 20) blockingCodes.push('DEFICIT_TOO_HIGH');
    else if (deficitPercent >= 15) warningCodes.push('DEFICIT_HIGH');
  } else if (targetKcal > tdeeKcal) {
    const surplusPercent = ((targetKcal - tdeeKcal) / tdeeKcal) * 100;
    if (surplusPercent > 15) blockingCodes.push('SURPLUS_TOO_HIGH');
    else if (surplusPercent >= 10) warningCodes.push('SURPLUS_HIGH');
  }
  return { warningCodes, blockingCodes };
}

export function buildNutritionDecision(input: {
  warningCodes?: NutritionWarningCode[];
  blockingCodes?: NutritionBlockingCode[];
}): NutritionDecision {
  const warningCodes = [...new Set(input.warningCodes ?? [])];
  const blockingCodes = [...new Set(input.blockingCodes ?? [])];
  const automaticPlanAllowed = blockingCodes.length === 0;
  const severity = blockingCodes.length
    ? 'block'
    : warningCodes.length
      ? 'warning'
      : 'none';
  return {
    warningCodes,
    blockingCodes,
    automaticPlanAllowed,
    severity,
    requiresProfessionalReview: blockingCodes.length > 0,
    rulesetVersions: NUTRITION_RULESET_VERSIONS,
  };
}

export function computeAdultBasics(input: {
  weightKg: number;
  heightCm: number;
  ageYears: number;
  equationSex: EquationSex;
  activityLevel: ActivityLevel;
}) {
  const blocking = validateAdultSupportedProfile(input);
  if (!input.equationSex) blocking.push('EQUATION_SEX_REQUIRED');
  if (blocking.length) {
    return {
      available: false as const,
      decision: buildNutritionDecision({ blockingCodes: blocking }),
    };
  }
  const bmiRaw = calcBmi(input.weightKg, input.heightCm);
  const range = healthyWeightRangeKg(input.heightCm);
  const reeRaw = calcReeKcal(input);
  const tdeeRaw = calcTdeeKcal(reeRaw, input.activityLevel);
  return {
    available: true as const,
    formulaVersions: NUTRITION_FORMULA_VERSIONS,
    rulesetVersions: NUTRITION_RULESET_VERSIONS,
    bmi: {
      value: roundHalfUp(bmiRaw, 4),
      category: adultBmiCategory(bmiRaw),
      healthyWeightRangeKg: {
        min: roundHalfUp(range.min, 3),
        max: roundHalfUp(range.max, 3),
      },
      valueSource: 'calculated' as const,
      formulaVersion: NUTRITION_FORMULA_VERSIONS.bmi,
    },
    ree: {
      kcalPerDay: roundHalfUp(reeRaw, 2),
      rawKcalPerDay: reeRaw,
      valueSource: 'estimated' as const,
      formulaVersion: NUTRITION_FORMULA_VERSIONS.ree,
    },
    tdee: {
      kcalPerDay: roundHalfUp(tdeeRaw, 2),
      rawKcalPerDay: tdeeRaw,
      activityLevel: input.activityLevel,
      activityMultiplier: ACTIVITY_MULTIPLIERS_V2[input.activityLevel],
      valueSource: 'estimated' as const,
      formulaVersion: NUTRITION_FORMULA_VERSIONS.tdee,
    },
  };
}

export type GoalTypeV2 = 'lose' | 'maintain' | 'gain';
export type GoalMethodV2 = 'weekly_rate' | 'target_date' | 'maintenance';
export type GoalFeasibility = 'reasonable' | 'aggressive' | 'unsupported';

export type GoalPlanInput =
  | { type: 'maintain' }
  | {
      type: 'lose' | 'gain';
      method: 'weekly_rate';
      targetWeightKg: number;
      weeklyChangeKg: number;
    }
  | {
      type: 'lose' | 'gain';
      method: 'target_date';
      targetWeightKg: number;
      targetDate: string;
    };

export function addCalendarDays(dateOnly: string, days: number): string {
  const d = new Date(`${dateOnly}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysBetweenDateOnly(start: string, end: string): number {
  const a = new Date(`${start}T00:00:00.000Z`).getTime();
  const b = new Date(`${end}T00:00:00.000Z`).getTime();
  return Math.round((b - a) / 86400000);
}

export function evaluateWeightGoal(input: {
  currentWeightKg: number;
  heightCm: number;
  calculationLocalDate: string;
  goal: GoalPlanInput;
}): {
  method: GoalMethodV2;
  type: GoalTypeV2;
  targetWeightKg: number | null;
  weeklyChangeKg: number | null;
  targetDate: string | null;
  estimatedWeeks: number | null;
  estimatedTargetDate: string | null;
  currentBmi: number;
  targetBmi: number | null;
  feasibility: GoalFeasibility | null;
  dailyEnergyAdjustment: number | null;
  warningCodes: NutritionWarningCode[];
  blockingCodes: NutritionBlockingCode[];
  errorCode?: string;
} {
  const warningCodes: NutritionWarningCode[] = [];
  const blockingCodes: NutritionBlockingCode[] = [];
  const currentBmi = calcBmi(input.currentWeightKg, input.heightCm);

  if (input.goal.type === 'maintain') {
    return {
      method: 'maintenance',
      type: 'maintain',
      targetWeightKg: null,
      weeklyChangeKg: null,
      targetDate: null,
      estimatedWeeks: null,
      estimatedTargetDate: null,
      currentBmi,
      targetBmi: null,
      feasibility: 'reasonable',
      dailyEnergyAdjustment: 0,
      warningCodes,
      blockingCodes,
    };
  }

  const targetWeightKg = input.goal.targetWeightKg;
  if (
    !isFiniteNumber(targetWeightKg) ||
    targetWeightKg < ADULT_SUPPORTED_RANGE.weightKg.min ||
    targetWeightKg > ADULT_SUPPORTED_RANGE.weightKg.max
  ) {
    return {
      method: input.goal.method,
      type: input.goal.type,
      targetWeightKg,
      weeklyChangeKg: null,
      targetDate: null,
      estimatedWeeks: null,
      estimatedTargetDate: null,
      currentBmi,
      targetBmi: null,
      feasibility: null,
      dailyEnergyAdjustment: null,
      warningCodes,
      blockingCodes: ['PROFILE_OUTSIDE_SUPPORTED_RANGE'],
      errorCode: 'INVALID_INPUT',
    };
  }

  if (input.goal.type === 'lose' && targetWeightKg >= input.currentWeightKg) {
    return {
      method: input.goal.method,
      type: input.goal.type,
      targetWeightKg,
      weeklyChangeKg: null,
      targetDate: null,
      estimatedWeeks: null,
      estimatedTargetDate: null,
      currentBmi,
      targetBmi: null,
      feasibility: null,
      dailyEnergyAdjustment: null,
      warningCodes,
      blockingCodes,
      errorCode: 'GOAL_DIRECTION_INVALID',
    };
  }
  if (input.goal.type === 'gain' && targetWeightKg <= input.currentWeightKg) {
    return {
      method: input.goal.method,
      type: input.goal.type,
      targetWeightKg,
      weeklyChangeKg: null,
      targetDate: null,
      estimatedWeeks: null,
      estimatedTargetDate: null,
      currentBmi,
      targetBmi: null,
      feasibility: null,
      dailyEnergyAdjustment: null,
      warningCodes,
      blockingCodes,
      errorCode: 'GOAL_DIRECTION_INVALID',
    };
  }

  const targetBmi = calcBmi(targetWeightKg, input.heightCm);
  if (input.goal.type === 'lose') {
    if (targetBmi < 18.5) blockingCodes.push('TARGET_BMI_TOO_LOW');
  } else {
    if (currentBmi >= 30 || targetBmi >= 30) {
      blockingCodes.push('TARGET_BMI_GAIN_UNSUPPORTED');
    }
  }

  let weeklyChangeKg: number;
  let targetDate: string | null = null;
  let estimatedWeeks: number;
  let estimatedTargetDate: string | null = null;

  if (input.goal.method === 'weekly_rate') {
    weeklyChangeKg = input.goal.weeklyChangeKg;
    if (!isFiniteNumber(weeklyChangeKg) || weeklyChangeKg <= 0) {
      return {
        method: 'weekly_rate',
        type: input.goal.type,
        targetWeightKg,
        weeklyChangeKg,
        targetDate: null,
        estimatedWeeks: null,
        estimatedTargetDate: null,
        currentBmi,
        targetBmi,
        feasibility: null,
        dailyEnergyAdjustment: null,
        warningCodes,
        blockingCodes,
        errorCode: 'INVALID_INPUT',
      };
    }
    estimatedWeeks =
      Math.abs(targetWeightKg - input.currentWeightKg) / weeklyChangeKg;
    if (estimatedWeeks > 52)
      blockingCodes.push('WEEKLY_RATE_DURATION_TOO_LONG');
    estimatedTargetDate = addCalendarDays(
      input.calculationLocalDate,
      Math.ceil(estimatedWeeks * 7),
    );
  } else {
    targetDate = input.goal.targetDate;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
      return {
        method: 'target_date',
        type: input.goal.type,
        targetWeightKg,
        weeklyChangeKg: null,
        targetDate,
        estimatedWeeks: null,
        estimatedTargetDate: null,
        currentBmi,
        targetBmi,
        feasibility: null,
        dailyEnergyAdjustment: null,
        warningCodes,
        blockingCodes,
        errorCode: 'TARGET_DATE_INVALID',
      };
    }
    const days = daysBetweenDateOnly(input.calculationLocalDate, targetDate);
    if (days <= 0) {
      return {
        method: 'target_date',
        type: input.goal.type,
        targetWeightKg,
        weeklyChangeKg: null,
        targetDate,
        estimatedWeeks: null,
        estimatedTargetDate: targetDate,
        currentBmi,
        targetBmi,
        feasibility: null,
        dailyEnergyAdjustment: null,
        warningCodes,
        blockingCodes,
        errorCode: 'TARGET_DATE_IN_PAST',
      };
    }
    if (days > 365) blockingCodes.push('TARGET_DATE_TOO_FAR');
    estimatedWeeks = days / 7;
    weeklyChangeKg =
      Math.abs(targetWeightKg - input.currentWeightKg) / estimatedWeeks;
    estimatedTargetDate = targetDate;
  }

  let feasibility: GoalFeasibility = 'reasonable';
  if (input.goal.type === 'lose') {
    const weeklyLossPercent = (weeklyChangeKg / input.currentWeightKg) * 100;
    if (weeklyChangeKg > 0.9 || weeklyLossPercent > 1) {
      feasibility = 'unsupported';
      blockingCodes.push('WEEKLY_RATE_TOO_HIGH');
    } else if (weeklyLossPercent > 0.75) {
      feasibility = 'aggressive';
      warningCodes.push('GOAL_RATE_AGGRESSIVE');
    }
  } else {
    const weeklyGainPercent = (weeklyChangeKg / input.currentWeightKg) * 100;
    if (weeklyChangeKg > 0.5 || weeklyGainPercent > 0.75) {
      feasibility = 'unsupported';
      blockingCodes.push('WEEKLY_RATE_TOO_HIGH');
    } else if (weeklyChangeKg > 0.25) {
      feasibility = 'aggressive';
      warningCodes.push('GOAL_RATE_AGGRESSIVE');
    }
  }

  const dailyEnergyAdjustment = (weeklyChangeKg * 7700) / 7;
  return {
    method: input.goal.method,
    type: input.goal.type,
    targetWeightKg,
    weeklyChangeKg: roundHalfUp(weeklyChangeKg, 3),
    targetDate,
    estimatedWeeks: roundHalfUp(estimatedWeeks, 3),
    estimatedTargetDate,
    currentBmi,
    targetBmi: roundHalfUp(targetBmi, 4),
    feasibility,
    dailyEnergyAdjustment,
    warningCodes,
    blockingCodes,
  };
}

export function computeGoalPlan(input: {
  weightKg: number;
  heightCm: number;
  ageYears: number;
  equationSex: EquationSex;
  activityLevel: ActivityLevel;
  calculationLocalDate: string;
  goal: GoalPlanInput;
  screening?: Partial<NutritionSafetyScreeningAnswers> | null;
}) {
  const basics = computeAdultBasics(input);
  const screeningBlocks = evaluateScreening(input.screening);
  if (!basics.available) {
    return {
      available: false as const,
      decision: buildNutritionDecision({
        blockingCodes: [...basics.decision.blockingCodes, ...screeningBlocks],
      }),
      basics: null,
      goal: null,
      calories: null,
    };
  }

  const goalEval = evaluateWeightGoal({
    currentWeightKg: input.weightKg,
    heightCm: input.heightCm,
    calculationLocalDate: input.calculationLocalDate,
    goal: input.goal,
  });
  if (goalEval.errorCode) {
    return {
      available: false as const,
      errorCode: goalEval.errorCode,
      decision: buildNutritionDecision({
        blockingCodes: [...goalEval.blockingCodes, ...screeningBlocks],
        warningCodes: goalEval.warningCodes,
      }),
      basics,
      goal: goalEval,
      calories: null,
    };
  }

  const reeRaw = basics.ree.rawKcalPerDay;
  const tdeeRaw = basics.tdee.rawKcalPerDay;
  let targetRaw = tdeeRaw;
  let adjustmentType: 'deficit' | 'surplus' | 'none' = 'none';
  if (goalEval.type === 'lose' && goalEval.dailyEnergyAdjustment != null) {
    targetRaw = tdeeRaw - goalEval.dailyEnergyAdjustment;
    adjustmentType = 'deficit';
  } else if (
    goalEval.type === 'gain' &&
    goalEval.dailyEnergyAdjustment != null
  ) {
    targetRaw = tdeeRaw + goalEval.dailyEnergyAdjustment;
    adjustmentType = 'surplus';
  }

  const calorieSafety = evaluateCalorieSafety({
    reeKcal: reeRaw,
    tdeeKcal: tdeeRaw,
    targetKcal: targetRaw,
  });
  if (goalEval.feasibility === 'unsupported') {
    calorieSafety.blockingCodes.push('WEEKLY_RATE_TOO_HIGH');
  }

  const decision = buildNutritionDecision({
    warningCodes: [...goalEval.warningCodes, ...calorieSafety.warningCodes],
    blockingCodes: [
      ...screeningBlocks,
      ...goalEval.blockingCodes,
      ...calorieSafety.blockingCodes,
    ],
  });

  const calories = decision.automaticPlanAllowed
    ? {
        targetKcalPerDay: roundHalfUp(targetRaw, 2),
        dailyAdjustmentKcal:
          goalEval.dailyEnergyAdjustment != null
            ? roundHalfUp(goalEval.dailyEnergyAdjustment, 2)
            : 0,
        adjustmentType,
        valueSource: 'estimated' as const,
        formulaVersion: NUTRITION_FORMULA_VERSIONS.calorieGoal,
      }
    : null;

  return {
    available: true as const,
    decision,
    basics,
    goal: {
      type: goalEval.type,
      method: goalEval.method,
      targetWeightKg: goalEval.targetWeightKg,
      weeklyChangeKg: goalEval.weeklyChangeKg,
      targetDate: goalEval.targetDate,
      estimatedWeeks: goalEval.estimatedWeeks,
      estimatedTargetDate: goalEval.estimatedTargetDate,
      feasibility: goalEval.feasibility,
      currentBmi: roundHalfUp(goalEval.currentBmi, 4),
      targetBmi: goalEval.targetBmi,
    },
    calories,
    formulaVersions: NUTRITION_FORMULA_VERSIONS,
    rulesetVersions: NUTRITION_RULESET_VERSIONS,
  };
}

export function confirmationTextVersionFor(
  warningCodes: NutritionWarningCode[],
): string {
  if (warningCodes.includes('GOAL_RATE_AGGRESSIVE')) {
    return 'nutrition-goal-aggressive-v1';
  }
  if (warningCodes.length > 0) return 'nutrition-goal-confirmation-v1';
  return 'nutrition-goal-confirmation-v1';
}

export function stableJson(value: unknown): string {
  return JSON.stringify(value, (_k, v: unknown) => {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const obj = v as Record<string, unknown>;
      return Object.keys(obj)
        .sort()
        .reduce<Record<string, unknown>>((acc, key) => {
          acc[key] = obj[key];
          return acc;
        }, {});
    }
    return v;
  });
}

export function hashContext(parts: unknown): string {
  return createHash('sha256').update(stableJson(parts)).digest('hex');
}

export function completionToleranceKg(targetWeightKg: number): number {
  return Math.max(0.2, (0.25 / 100) * targetWeightKg);
}

export function weightQualifiesForGoal(input: {
  goalType: 'lose' | 'gain';
  weightKg: number;
  targetWeightKg: number;
}): boolean {
  const tol = completionToleranceKg(input.targetWeightKg);
  if (input.goalType === 'lose') {
    return input.weightKg <= input.targetWeightKg + tol;
  }
  return input.weightKg >= input.targetWeightKg - tol;
}

export function evaluateCompletionEligibility(input: {
  goalType: 'lose' | 'gain' | 'maintain' | 'manual';
  targetWeightKg: number | null;
  activatedAt: Date | null;
  timezone: string;
  weightLogs: Array<{ id: string; weightKg: number; loggedAt: Date }>;
}): {
  eligible: boolean;
  evidenceWeightLogIds: string[];
  qualifyingLocalDates: string[];
} {
  if (
    (input.goalType !== 'lose' && input.goalType !== 'gain') ||
    input.targetWeightKg == null ||
    !input.activatedAt
  ) {
    return {
      eligible: false,
      evidenceWeightLogIds: [],
      qualifyingLocalDates: [],
    };
  }

  const byDate = new Map<string, { id: string; weightKg: number }>();
  for (const log of input.weightLogs) {
    if (log.loggedAt.getTime() < input.activatedAt.getTime()) continue;
    if (
      log.weightKg < ADULT_SUPPORTED_RANGE.weightKg.min ||
      log.weightKg > ADULT_SUPPORTED_RANGE.weightKg.max
    ) {
      continue;
    }
    if (
      !weightQualifiesForGoal({
        goalType: input.goalType,
        weightKg: log.weightKg,
        targetWeightKg: input.targetWeightKg,
      })
    ) {
      continue;
    }
    const local = localDateFromInstant(log.loggedAt, input.timezone);
    if (!byDate.has(local)) {
      byDate.set(local, { id: log.id, weightKg: log.weightKg });
    }
  }

  const dates = [...byDate.keys()].sort();
  if (dates.length < 2) {
    return {
      eligible: false,
      evidenceWeightLogIds: dates.map((d) => byDate.get(d)!.id),
      qualifyingLocalDates: dates,
    };
  }
  const evidenceDates = dates.slice(0, 2);
  return {
    eligible: true,
    evidenceWeightLogIds: evidenceDates.map((d) => byDate.get(d)!.id),
    qualifyingLocalDates: evidenceDates,
  };
}

function localDateFromInstant(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}
