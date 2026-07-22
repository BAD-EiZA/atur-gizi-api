import { NutritionV2Service } from './nutrition-v2.service';

describe('NutritionV2Service', () => {
  const service = new NutritionV2Service({} as never);

  it('previewFromInputs returns adult basics for supported profile', () => {
    const result = service.previewFromInputs({
      weightKg: 61.3,
      heightCm: 155,
      ageYears: 30,
      equationSex: 'female',
      activityLevel: 'light',
      calculationLocalDate: '2026-07-22',
      timezone: 'Asia/Jakarta',
    });
    expect(result.available).toBe(true);
    if (!result.available) return;
    expect(result.bmi?.value).toBe(25.5151);
    expect(result.bmi?.category).toBe('overweight');
    expect(result.bmi?.healthyWeightRangeKg.max).toBe(59.822);
    expect(result.ree?.kcalPerDay).toBe(1270.75);
    expect(result.tdee?.kcalPerDay).toBe(1747.28);
    expect(result.tdee?.activityMultiplier).toBe(1.375);
    expect(result.decision.automaticPlanAllowed).toBe(true);
    expect(result.formulaVersions.bmi).toBe('adult_bmi_v1');
  });

  it('blocks adolescent automatic basics', () => {
    const result = service.previewFromInputs({
      weightKg: 61.3,
      heightCm: 155,
      ageYears: 17,
      equationSex: 'female',
      activityLevel: 'light',
    });
    expect(result.available).toBe(false);
    expect(result.decision.blockingCodes).toContain('AGE_UNSUPPORTED');
    expect(result.bmi).toBeNull();
    expect(result.ree).toBeNull();
    expect(result.tdee).toBeNull();
  });

  it('requires equation sex', () => {
    const result = service.previewFromInputs({
      weightKg: 61.3,
      heightCm: 155,
      ageYears: 30,
      equationSex: null,
      activityLevel: 'light',
    });
    expect(result.available).toBe(false);
    expect(result.decision.blockingCodes).toContain('EQUATION_SEX_REQUIRED');
  });
});
