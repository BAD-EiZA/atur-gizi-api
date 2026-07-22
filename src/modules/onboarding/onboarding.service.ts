import { HttpStatus, Injectable } from '@nestjs/common';
import { MetabolicFormula } from '@prisma/client';
import { UsersService } from '../users/users.service';
import { CompleteOnboardingDto, PreviewTargetDto } from './dto/onboarding.dto';
import {
  ageFromDob,
  localDateString,
  parseDateOnly,
} from '../../common/utils/date.util';
import {
  computeMacroTargets,
  computeTarget,
} from '../../common/utils/nutrition.util';
import {
  canUseAdultAutomaticPlan,
  equationSexFromProfile,
  normalizeMetabolicFormula,
} from '../../common/utils/nutrition-v2.util';
import { AppException } from '../../common/errors/app.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { NutritionV2Service } from '../nutrition-v2/nutrition-v2.service';

@Injectable()
export class OnboardingService {
  constructor(
    private readonly users: UsersService,
    private readonly prisma: PrismaService,
    private readonly nutritionV2: NutritionV2Service,
  ) {}

  private resolveFormula(dto: PreviewTargetDto): MetabolicFormula {
    let formula = dto.metabolicFormula;
    if (dto.sex === 'male' && (!formula || formula === 'manual'))
      formula = 'mifflin_a';
    if (dto.sex === 'female' && (!formula || formula === 'manual'))
      formula = 'mifflin_b';
    return normalizeMetabolicFormula(formula, dto.sex);
  }

  preview(dto: PreviewTargetDto) {
    this.users.assertMinAge(dto.dateOfBirth);
    const ageYears = ageFromDob(parseDateOnly(dto.dateOfBirth));
    const formula = this.resolveFormula(dto);
    const adultAutomaticAllowed = canUseAdultAutomaticPlan(ageYears);
    if (
      !adultAutomaticAllowed &&
      formula !== 'manual' &&
      dto.fitnessGoal !== 'manual'
    ) {
      throw new AppException(
        'AGE_UNSUPPORTED',
        'Kalkulasi target otomatis dewasa tersedia untuk usia 20–100 tahun. Gunakan target manual atau lanjutkan pencatatan.',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    try {
      const result = computeTarget({
        formula,
        weightKg: dto.weightKg,
        heightCm: dto.heightCm,
        ageYears,
        activityLevel: dto.activityLevel ?? null,
        goal: dto.fitnessGoal,
        targetRatePct: dto.targetRate,
        manualTarget: dto.manualTarget,
      });
      const basics = this.nutritionV2.previewFromInputs({
        weightKg: dto.weightKg,
        heightCm: dto.heightCm,
        ageYears,
        equationSex: equationSexFromProfile(dto.sex, formula),
        activityLevel: dto.activityLevel ?? null,
      });
      return {
        age_years: ageYears,
        bmr_kcal: result.bmrKcal,
        tdee_kcal: result.tdeeKcal,
        calorie_target: result.calorieTarget,
        calculation_method: result.calculationMethod,
        formula_version: result.formulaVersion,
        metabolic_formula: formula,
        adult_automatic_allowed: adultAutomaticAllowed,
        nutrition_basics: basics,
        calculation_inputs: {
          ...result.calculationInputs,
          metabolic_formula_normalized: formula,
          target_rate_unit: 'percent_tdee',
        },
        disclaimer:
          'Estimasi kalori dan nutrisi dapat tidak akurat. Aplikasi ini bukan pengganti nasihat medis atau ahli gizi.',
      };
    } catch (e) {
      throw new AppException(
        'TARGET_CALCULATION_FAILED',
        e instanceof Error ? e.message : 'Gagal menghitung target.',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  async complete(appUserId: string, dto: CompleteOnboardingDto) {
    if (!dto.estimatesAccepted) {
      throw new AppException(
        'ESTIMATES_NOT_ACCEPTED',
        'Anda harus menyetujui bahwa angka adalah estimasi.',
        HttpStatus.BAD_REQUEST,
      );
    }
    this.users.assertMinAge(dto.dateOfBirth);
    const formula = this.resolveFormula(dto);
    const preview = this.preview({ ...dto, metabolicFormula: formula });
    const dob = parseDateOnly(dto.dateOfBirth);
    const timezone = dto.timezone ?? 'Asia/Jakarta';
    const today = parseDateOnly(localDateString(new Date(), timezone));

    await this.prisma.$transaction(async (tx) => {
      if (dto.displayName) {
        await tx.appUser.update({
          where: { id: appUserId },
          data: { displayName: dto.displayName },
        });
      }
      await tx.userProfile.update({
        where: { userId: appUserId },
        data: {
          dateOfBirth: dob,
          heightCm: dto.heightCm,
          currentWeightKg: dto.weightKg,
          sex: dto.sex ?? 'unspecified',
          metabolicFormula: formula,
          activityLevel: dto.activityLevel,
          fitnessGoal: dto.fitnessGoal,
          targetRate: dto.targetRate,
          formulaVersion: preview.formula_version,
          estimatesAccepted: true,
          onboardingCompleted: true,
        },
      });
      await tx.userSettings.update({
        where: { userId: appUserId },
        data: {
          timezone,
          unitSystem: dto.unitSystem ?? 'metric',
        },
      });

      const open = await tx.dailyTarget.findFirst({
        where: { userId: appUserId, effectiveTo: null },
        orderBy: { effectiveFrom: 'desc' },
      });
      if (open) {
        const dayBefore = new Date(today);
        dayBefore.setUTCDate(dayBefore.getUTCDate() - 1);
        await tx.dailyTarget.update({
          where: { id: open.id },
          data: { effectiveTo: dayBefore },
        });
      }
      const macros = computeMacroTargets({
        calorieTarget: preview.calorie_target,
        weightKg: dto.weightKg,
        goal: dto.fitnessGoal,
      });
      await tx.dailyTarget.create({
        data: {
          userId: appUserId,
          effectiveFrom: today,
          bmrKcal: preview.bmr_kcal,
          tdeeKcal: preview.tdee_kcal,
          calorieTarget: preview.calorie_target,
          proteinTargetG: macros.proteinG,
          carbsTargetG: macros.carbsG,
          fatTargetG: macros.fatG,
          goal: dto.fitnessGoal,
          calculationMethod: preview.calculation_method,
          calculationInputs: {
            ...(preview.calculation_inputs as object),
            macros_method: macros.method,
            metabolic_formula_normalized: formula,
            target_rate_unit: 'percent_tdee',
          },
        },
      });
    });

    return {
      ...preview,
      onboarding_completed: true,
    };
  }
}
