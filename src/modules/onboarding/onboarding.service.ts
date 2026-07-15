import { HttpStatus, Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { CompleteOnboardingDto, PreviewTargetDto } from './dto/onboarding.dto';
import { ageFromDob, localDateString, parseDateOnly } from '../../common/utils/date.util';
import { computeTarget } from '../../common/utils/nutrition.util';
import { AppException } from '../../common/errors/app.exception';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class OnboardingService {
  constructor(
    private readonly users: UsersService,
    private readonly prisma: PrismaService,
  ) {}

  preview(dto: PreviewTargetDto) {
    this.users.assertMinAge(dto.dateOfBirth);
    const ageYears = ageFromDob(parseDateOnly(dto.dateOfBirth));
    try {
      const result = computeTarget({
        formula: dto.metabolicFormula,
        weightKg: dto.weightKg,
        heightCm: dto.heightCm,
        ageYears,
        activityLevel: dto.activityLevel ?? null,
        goal: dto.fitnessGoal,
        targetRatePct: dto.targetRate,
        manualTarget: dto.manualTarget,
      });
      return {
        age_years: ageYears,
        bmr_kcal: result.bmrKcal,
        tdee_kcal: result.tdeeKcal,
        calorie_target: result.calorieTarget,
        calculation_method: result.calculationMethod,
        formula_version: result.formulaVersion,
        calculation_inputs: result.calculationInputs,
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
    const preview = this.preview(dto);
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
          metabolicFormula: dto.metabolicFormula,
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
      await tx.dailyTarget.create({
        data: {
          userId: appUserId,
          effectiveFrom: today,
          bmrKcal: preview.bmr_kcal,
          tdeeKcal: preview.tdee_kcal,
          calorieTarget: preview.calorie_target,
          goal: dto.fitnessGoal,
          calculationMethod: preview.calculation_method,
          calculationInputs: preview.calculation_inputs as object,
        },
      });
    });

    return {
      ...preview,
      onboarding_completed: true,
    };
  }
}
