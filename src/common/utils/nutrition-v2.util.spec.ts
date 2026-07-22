import {
  ADULT_SUPPORTED_RANGE,
  adultBmiCategory,
  buildNutritionDecision,
  calcBmi,
  calcReeKcal,
  calcTdeeKcal,
  canUseAdultAutomaticPlan,
  computeAdultBasics,
  computeGoalPlan,
  evaluateCompletionEligibility,
  equationSexFromProfile,
  evaluateCalorieSafety,
  evaluateScreening,
  healthyWeightRangeKg,
  normalizeMetabolicFormula,
  roundHalfUp,
  validateAdultSupportedProfile,
} from './nutrition-v2.util';

describe('nutrition-v2 foundation', () => {
  it('normalizes metabolic formula from sex before calculation', () => {
    expect(normalizeMetabolicFormula('mifflin_b', 'male')).toBe('mifflin_a');
    expect(normalizeMetabolicFormula('mifflin_a', 'female')).toBe('mifflin_b');
    expect(normalizeMetabolicFormula('manual', 'male')).toBe('manual');
    expect(equationSexFromProfile('unspecified', 'mifflin_a')).toBe('male');
  });

  it('gates adult automatic plan by age', () => {
    expect(canUseAdultAutomaticPlan(19)).toBe(false);
    expect(canUseAdultAutomaticPlan(20)).toBe(true);
    expect(canUseAdultAutomaticPlan(100)).toBe(true);
    expect(canUseAdultAutomaticPlan(101)).toBe(false);
    expect(
      validateAdultSupportedProfile({
        ageYears: 19,
        heightCm: 170,
        weightKg: 70,
      }),
    ).toContain('AGE_UNSUPPORTED');
  });

  it('validates product supported ranges', () => {
    expect(
      validateAdultSupportedProfile({
        ageYears: 30,
        heightCm: ADULT_SUPPORTED_RANGE.heightCm.min - 0.001,
        weightKg: 70,
      }),
    ).toContain('PROFILE_OUTSIDE_SUPPORTED_RANGE');
    expect(
      validateAdultSupportedProfile({
        ageYears: 30,
        heightCm: 170,
        weightKg: ADULT_SUPPORTED_RANGE.weightKg.max + 0.001,
      }),
    ).toContain('PROFILE_OUTSIDE_SUPPORTED_RANGE');
  });

  it('computes golden BMI/REE/TDEE vectors', () => {
    const bmi = calcBmi(61.3, 155);
    expect(roundHalfUp(bmi, 4)).toBe(25.5151);
    expect(adultBmiCategory(bmi)).toBe('overweight');
    const range = healthyWeightRangeKg(155);
    expect(roundHalfUp(range.min, 3)).toBe(44.446);
    expect(roundHalfUp(range.max, 3)).toBe(59.822);

    const ree = calcReeKcal({
      weightKg: 61.3,
      heightCm: 155,
      ageYears: 30,
      equationSex: 'female',
    });
    expect(ree).toBeCloseTo(1270.75, 8);
    const tdee = calcTdeeKcal(ree, 'light');
    expect(roundHalfUp(tdee, 2)).toBe(1747.28);
  });

  it('classifies BMI boundaries', () => {
    expect(adultBmiCategory(18.4999)).toBe('underweight');
    expect(adultBmiCategory(18.5)).toBe('healthy');
    expect(adultBmiCategory(24.9999)).toBe('healthy');
    expect(adultBmiCategory(25)).toBe('overweight');
    expect(adultBmiCategory(29.9999)).toBe('overweight');
    expect(adultBmiCategory(30)).toBe('obesity_class_1');
    expect(adultBmiCategory(34.9999)).toBe('obesity_class_1');
    expect(adultBmiCategory(35)).toBe('obesity_class_2');
    expect(adultBmiCategory(39.9999)).toBe('obesity_class_2');
    expect(adultBmiCategory(40)).toBe('obesity_class_3');
  });

  it('evaluates screening answers deterministically', () => {
    expect(evaluateScreening(null)).toEqual(['SCREENING_INCOMPLETE']);
    expect(
      evaluateScreening({
        isPregnant: 'unknown',
        isBreastfeeding: 'no',
        hasKidneyDisease: 'no',
        hasLiverDisease: 'no',
        hasHeartFailureOrFluidRetention: 'no',
        usesHypoglycemiaRiskMedication: 'no',
        hasEatingDisorderHistory: 'no',
      }),
    ).toEqual(['SCREENING_INCOMPLETE']);
    expect(
      evaluateScreening({
        isPregnant: 'no',
        isBreastfeeding: 'no',
        hasKidneyDisease: 'yes',
        hasLiverDisease: 'no',
        hasHeartFailureOrFluidRetention: 'no',
        usesHypoglycemiaRiskMedication: 'no',
        hasEatingDisorderHistory: 'no',
      }),
    ).toEqual(['KIDNEY_CONDITION']);
  });

  it('evaluates calorie safety without epsilon', () => {
    const ree = 1270.75;
    const tdee = 1747.28125;
    expect(
      evaluateCalorieSafety({
        reeKcal: ree,
        tdeeKcal: tdee,
        targetKcal: ree - 0.001,
      }).blockingCodes,
    ).toContain('CALORIE_TARGET_BELOW_REE');
    expect(
      evaluateCalorieSafety({ reeKcal: ree, tdeeKcal: tdee, targetKcal: ree })
        .warningCodes,
    ).toContain('TARGET_EQUALS_REE');
    const highDeficit = evaluateCalorieSafety({
      reeKcal: ree,
      tdeeKcal: tdee,
      targetKcal: 1417.28125,
    });
    expect(highDeficit.warningCodes).toContain('DEFICIT_HIGH');
    expect(highDeficit.blockingCodes).not.toContain('DEFICIT_TOO_HIGH');
    expect(
      evaluateCalorieSafety({
        reeKcal: ree,
        tdeeKcal: 2000,
        targetKcal: 2000 * 0.79,
      }).blockingCodes,
    ).toContain('DEFICIT_TOO_HIGH');
  });

  it('derives decision severity from codes', () => {
    expect(
      buildNutritionDecision({ warningCodes: ['DEFICIT_HIGH'] }).severity,
    ).toBe('warning');
    expect(
      buildNutritionDecision({ blockingCodes: ['AGE_UNSUPPORTED'] })
        .automaticPlanAllowed,
    ).toBe(false);
    expect(buildNutritionDecision({}).severity).toBe('none');
  });

  it('returns unavailable adult basics outside range', () => {
    const result = computeAdultBasics({
      weightKg: 61.3,
      heightCm: 155,
      ageYears: 17,
      equationSex: 'female',
      activityLevel: 'light',
    });
    expect(result.available).toBe(false);
    if (!result.available) {
      expect(result.decision.blockingCodes).toContain('AGE_UNSUPPORTED');
    }
  });

  it('computes lose weekly goal with deficit warning', () => {
    const plan = computeGoalPlan({
      weightKg: 61.3,
      heightCm: 155,
      ageYears: 30,
      equationSex: 'female',
      activityLevel: 'light',
      calculationLocalDate: '2026-07-22',
      goal: {
        type: 'lose',
        method: 'weekly_rate',
        targetWeightKg: 56,
        weeklyChangeKg: 0.3,
      },
      screening: {
        isPregnant: 'no',
        isBreastfeeding: 'no',
        hasKidneyDisease: 'no',
        hasLiverDisease: 'no',
        hasHeartFailureOrFluidRetention: 'no',
        usesHypoglycemiaRiskMedication: 'no',
        hasEatingDisorderHistory: 'no',
      },
    });
    expect(plan.available).toBe(true);
    if (!plan.available) return;
    expect(plan.goal?.estimatedWeeks).toBe(17.667);
    expect(plan.calories?.targetKcalPerDay).toBe(1417.28);
    expect(plan.decision.warningCodes).toContain('DEFICIT_HIGH');
    expect(plan.decision.automaticPlanAllowed).toBe(true);
  });

  it('blocks gain to BMI 30+', () => {
    const plan = computeGoalPlan({
      weightKg: 70,
      heightCm: 160,
      ageYears: 30,
      equationSex: 'female',
      activityLevel: 'moderate',
      calculationLocalDate: '2026-07-22',
      goal: {
        type: 'gain',
        method: 'weekly_rate',
        targetWeightKg: 90,
        weeklyChangeKg: 0.2,
      },
      screening: {
        isPregnant: 'no',
        isBreastfeeding: 'no',
        hasKidneyDisease: 'no',
        hasLiverDisease: 'no',
        hasHeartFailureOrFluidRetention: 'no',
        usesHypoglycemiaRiskMedication: 'no',
        hasEatingDisorderHistory: 'no',
      },
    });
    expect(plan.decision.blockingCodes).toContain(
      'TARGET_BMI_GAIN_UNSUPPORTED',
    );
    expect(plan.calories).toBeNull();
  });

  it('evaluates completion eligibility from two local dates', () => {
    const activatedAt = new Date('2026-07-01T00:00:00.000Z');
    const result = evaluateCompletionEligibility({
      goalType: 'lose',
      targetWeightKg: 56,
      activatedAt,
      timezone: 'Asia/Jakarta',
      weightLogs: [
        {
          id: 'w1',
          weightKg: 55.9,
          loggedAt: new Date('2026-07-10T01:00:00.000Z'),
        },
        {
          id: 'w2',
          weightKg: 55.8,
          loggedAt: new Date('2026-07-11T01:00:00.000Z'),
        },
      ],
    });
    expect(result.eligible).toBe(true);
    expect(result.evidenceWeightLogIds).toHaveLength(2);
  });

  it('blocks weekly duration over 52 weeks', () => {
    const plan = computeGoalPlan({
      weightKg: 80,
      heightCm: 170,
      ageYears: 30,
      equationSex: 'male',
      activityLevel: 'moderate',
      calculationLocalDate: '2026-07-22',
      goal: {
        type: 'lose',
        method: 'weekly_rate',
        targetWeightKg: 60,
        weeklyChangeKg: 0.2,
      },
      screening: {
        isPregnant: 'no',
        isBreastfeeding: 'no',
        hasKidneyDisease: 'no',
        hasLiverDisease: 'no',
        hasHeartFailureOrFluidRetention: 'no',
        usesHypoglycemiaRiskMedication: 'no',
        hasEatingDisorderHistory: 'no',
      },
    });
    expect(plan.decision.blockingCodes).toContain(
      'WEEKLY_RATE_DURATION_TOO_LONG',
    );
  });
});
