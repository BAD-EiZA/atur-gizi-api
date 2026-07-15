"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ACTIVITY_FORMULA_VERSION = exports.FORMULA_VERSION = void 0;
exports.calcBmr = calcBmr;
exports.calcTdee = calcTdee;
exports.applyGoal = applyGoal;
exports.computeTarget = computeTarget;
exports.calcActivityCalories = calcActivityCalories;
exports.confidenceLabel = confidenceLabel;
const date_util_1 = require("./date.util");
exports.FORMULA_VERSION = 'mifflin_st_jeor_v1';
exports.ACTIVITY_FORMULA_VERSION = 'met_kcal_v1';
const ACTIVITY_FACTORS = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    high: 1.725,
    very_high: 1.9,
};
function calcBmr(formula, weightKg, heightCm, ageYears) {
    if (formula === 'manual')
        return null;
    const base = 10 * weightKg + 6.25 * heightCm - 5 * ageYears;
    if (formula === 'mifflin_a')
        return base + 5;
    return base - 161;
}
function calcTdee(bmr, level) {
    return bmr * ACTIVITY_FACTORS[level];
}
function applyGoal(tdee, goal, targetRatePct) {
    if (goal === 'manual')
        return tdee;
    if (goal === 'maintain')
        return tdee;
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
function computeTarget(input) {
    if (input.goal === 'manual' || input.formula === 'manual') {
        const calorieTarget = (0, date_util_1.roundToNearest10)(input.manualTarget ?? 2000);
        return {
            bmrKcal: null,
            tdeeKcal: null,
            calorieTarget,
            calculationMethod: 'manual',
            formulaVersion: exports.FORMULA_VERSION,
            calculationInputs: { ...input },
        };
    }
    if (!input.activityLevel) {
        throw new Error('activity_level_required');
    }
    const bmr = calcBmr(input.formula, input.weightKg, input.heightCm, input.ageYears);
    if (bmr == null)
        throw new Error('bmr_failed');
    const tdee = calcTdee(bmr, input.activityLevel);
    const adjusted = applyGoal(tdee, input.goal, input.targetRatePct);
    return {
        bmrKcal: Math.round(bmr),
        tdeeKcal: Math.round(tdee),
        calorieTarget: (0, date_util_1.roundToNearest10)(adjusted),
        calculationMethod: exports.FORMULA_VERSION,
        formulaVersion: exports.FORMULA_VERSION,
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
function calcActivityCalories(met, weightKg, durationMinutes) {
    return Math.round((met * 3.5 * weightKg * durationMinutes) / 200);
}
function confidenceLabel(c) {
    if (c >= 0.8)
        return 'Tinggi';
    if (c >= 0.55)
        return 'Sedang';
    return 'Rendah';
}
//# sourceMappingURL=nutrition.util.js.map