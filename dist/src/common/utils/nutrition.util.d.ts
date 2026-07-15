import { ActivityLevel, FitnessGoal, MetabolicFormula } from '@prisma/client';
export declare const FORMULA_VERSION = "mifflin_st_jeor_v1";
export declare const ACTIVITY_FORMULA_VERSION = "met_kcal_v1";
export declare function calcBmr(formula: MetabolicFormula, weightKg: number, heightCm: number, ageYears: number): number | null;
export declare function calcTdee(bmr: number, level: ActivityLevel): number;
export declare function applyGoal(tdee: number, goal: FitnessGoal, targetRatePct?: number | null): number;
export declare function computeTarget(input: {
    formula: MetabolicFormula;
    weightKg: number;
    heightCm: number;
    ageYears: number;
    activityLevel: ActivityLevel | null;
    goal: FitnessGoal;
    targetRatePct?: number | null;
    manualTarget?: number | null;
}): {
    bmrKcal: number | null;
    tdeeKcal: number | null;
    calorieTarget: number;
    calculationMethod: string;
    formulaVersion: string;
    calculationInputs: {
        formula: MetabolicFormula;
        weightKg: number;
        heightCm: number;
        ageYears: number;
        activityLevel: ActivityLevel | null;
        goal: FitnessGoal;
        targetRatePct?: number | null;
        manualTarget?: number | null;
        activityFactor?: undefined;
    };
} | {
    bmrKcal: number;
    tdeeKcal: number;
    calorieTarget: number;
    calculationMethod: string;
    formulaVersion: string;
    calculationInputs: {
        formula: "mifflin_a" | "mifflin_b";
        weightKg: number;
        heightCm: number;
        ageYears: number;
        activityLevel: import(".prisma/client").$Enums.ActivityLevel;
        goal: "lose_weight" | "maintain" | "gain_weight";
        targetRatePct: number | null;
        activityFactor: number;
    };
};
export declare function calcActivityCalories(met: number, weightKg: number, durationMinutes: number): number;
export declare function confidenceLabel(c: number): 'Tinggi' | 'Sedang' | 'Rendah';
