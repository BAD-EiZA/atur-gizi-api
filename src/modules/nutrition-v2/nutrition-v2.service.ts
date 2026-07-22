import { HttpStatus, Injectable } from '@nestjs/common';
import type { ActivityLevel } from '@prisma/client';
import { AppException } from '../../common/errors/app.exception';
import { ageFromDob, localDateString } from '../../common/utils/date.util';
import {
  buildNutritionDecision,
  canUseAdultAutomaticPlan,
  computeAdultBasics,
  equationSexFromProfile,
  NUTRITION_FORMULA_VERSIONS,
  NUTRITION_RULESET_VERSIONS,
  type EquationSex,
  type NutritionBlockingCode,
} from '../../common/utils/nutrition-v2.util';
import { PrismaService } from '../../prisma/prisma.service';
import { PreviewNutritionBasicsDto } from './dto/nutrition-basics.dto';

@Injectable()
export class NutritionV2Service {
  constructor(private readonly prisma: PrismaService) {}

  async basicsFromProfile(appUserId: string) {
    if (!appUserId) {
      throw new AppException(
        'USER_NOT_SYNCED',
        'Panggil /v1/users/sync terlebih dahulu.',
        HttpStatus.NOT_FOUND,
      );
    }
    const user = await this.prisma.appUser.findUnique({
      where: { id: appUserId },
      include: { profile: true, settings: true },
    });
    if (!user?.profile) {
      throw new AppException(
        'USER_NOT_FOUND',
        'Pengguna tidak ditemukan.',
        HttpStatus.NOT_FOUND,
      );
    }
    const p = user.profile;
    const tz = user.settings?.timezone ?? 'Asia/Jakarta';
    if (!p.dateOfBirth || p.currentWeightKg == null || p.heightCm == null) {
      return this.unavailable(['PROFILE_OUTSIDE_SUPPORTED_RANGE'], {
        requiresInput: true,
      });
    }
    const ageYears = ageFromDob(p.dateOfBirth);
    const equationSex = equationSexFromProfile(p.sex, p.metabolicFormula);
    if (!equationSex) {
      return this.unavailable(['EQUATION_SEX_REQUIRED'], {
        requiresInput: true,
      });
    }
    if (!p.activityLevel) {
      return this.unavailable(['PROFILE_OUTSIDE_SUPPORTED_RANGE'], {
        requiresInput: true,
        message: 'activity_level_required',
      });
    }
    return this.compute({
      weightKg: Number(p.currentWeightKg),
      heightCm: Number(p.heightCm),
      ageYears,
      equationSex,
      activityLevel: p.activityLevel,
      calculationLocalDate: localDateString(new Date(), tz),
      timezone: tz,
    });
  }

  async previewBasics(appUserId: string, dto: PreviewNutritionBasicsDto) {
    if (!appUserId) {
      throw new AppException(
        'USER_NOT_SYNCED',
        'Panggil /v1/users/sync terlebih dahulu.',
        HttpStatus.NOT_FOUND,
      );
    }
    const user = await this.prisma.appUser.findUnique({
      where: { id: appUserId },
      include: { profile: true, settings: true },
    });
    if (!user?.profile) {
      throw new AppException(
        'USER_NOT_FOUND',
        'Pengguna tidak ditemukan.',
        HttpStatus.NOT_FOUND,
      );
    }
    const p = user.profile;
    const tz = user.settings?.timezone ?? 'Asia/Jakarta';
    const weightKg =
      dto.weightKg ??
      (p.currentWeightKg != null ? Number(p.currentWeightKg) : null);
    const heightCm =
      dto.heightCm ?? (p.heightCm != null ? Number(p.heightCm) : null);
    if (!p.dateOfBirth || weightKg == null || heightCm == null) {
      return this.unavailable(['PROFILE_OUTSIDE_SUPPORTED_RANGE'], {
        requiresInput: true,
      });
    }
    const ageYears = ageFromDob(p.dateOfBirth);
    const sex = dto.sex ?? p.sex;
    const formula = p.metabolicFormula;
    const equationSex = equationSexFromProfile(sex, formula);
    if (!equationSex) {
      return this.unavailable(['EQUATION_SEX_REQUIRED'], {
        requiresInput: true,
      });
    }
    const activityLevel = dto.activityLevel ?? p.activityLevel;
    if (!activityLevel) {
      return this.unavailable(['PROFILE_OUTSIDE_SUPPORTED_RANGE'], {
        requiresInput: true,
        message: 'activity_level_required',
      });
    }
    return this.compute({
      weightKg,
      heightCm,
      ageYears,
      equationSex,
      activityLevel,
      calculationLocalDate: localDateString(new Date(), tz),
      timezone: tz,
    });
  }

  previewFromInputs(input: {
    weightKg: number;
    heightCm: number;
    ageYears: number;
    equationSex: EquationSex | null;
    activityLevel: ActivityLevel | null;
    calculationLocalDate?: string;
    timezone?: string;
  }) {
    if (!input.equationSex) {
      return this.unavailable(['EQUATION_SEX_REQUIRED'], {
        requiresInput: true,
      });
    }
    if (!input.activityLevel) {
      return this.unavailable(['PROFILE_OUTSIDE_SUPPORTED_RANGE'], {
        requiresInput: true,
        message: 'activity_level_required',
      });
    }
    return this.compute({
      weightKg: input.weightKg,
      heightCm: input.heightCm,
      ageYears: input.ageYears,
      equationSex: input.equationSex,
      activityLevel: input.activityLevel,
      calculationLocalDate: input.calculationLocalDate,
      timezone: input.timezone,
    });
  }

  private compute(input: {
    weightKg: number;
    heightCm: number;
    ageYears: number;
    equationSex: EquationSex;
    activityLevel: ActivityLevel;
    calculationLocalDate?: string;
    timezone?: string;
  }) {
    if (!canUseAdultAutomaticPlan(input.ageYears)) {
      return this.unavailable(['AGE_UNSUPPORTED']);
    }
    const result = computeAdultBasics(input);
    if (!result.available) {
      return {
        available: false as const,
        ageYears: input.ageYears,
        calculationLocalDate: input.calculationLocalDate ?? null,
        timezone: input.timezone ?? null,
        formulaVersions: NUTRITION_FORMULA_VERSIONS,
        rulesetVersions: NUTRITION_RULESET_VERSIONS,
        decision: result.decision,
        bmi: null,
        ree: null,
        tdee: null,
        disclaimer:
          'Nilai nutrisi adalah estimasi. Bukan diagnosis atau pengganti konsultasi tenaga kesehatan.',
      };
    }
    return {
      available: true as const,
      ageYears: input.ageYears,
      calculationLocalDate: input.calculationLocalDate ?? null,
      timezone: input.timezone ?? null,
      formulaVersions: result.formulaVersions,
      rulesetVersions: result.rulesetVersions,
      decision: buildNutritionDecision({}),
      bmi: result.bmi,
      ree: {
        kcalPerDay: result.ree.kcalPerDay,
        valueSource: result.ree.valueSource,
        formulaVersion: result.ree.formulaVersion,
        equation: 'mifflin_st_jeor' as const,
      },
      tdee: {
        kcalPerDay: result.tdee.kcalPerDay,
        activityLevel: result.tdee.activityLevel,
        activityMultiplier: result.tdee.activityMultiplier,
        valueSource: result.tdee.valueSource,
        formulaVersion: result.tdee.formulaVersion,
      },
      disclaimer:
        'Nilai nutrisi adalah estimasi. Bukan diagnosis atau pengganti konsultasi tenaga kesehatan.',
    };
  }

  private unavailable(
    blockingCodes: NutritionBlockingCode[],
    opts?: { requiresInput?: boolean; message?: string },
  ) {
    return {
      available: false as const,
      ageYears: null as number | null,
      calculationLocalDate: null as string | null,
      timezone: null as string | null,
      formulaVersions: NUTRITION_FORMULA_VERSIONS,
      rulesetVersions: NUTRITION_RULESET_VERSIONS,
      decision: buildNutritionDecision({ blockingCodes }),
      bmi: null,
      ree: null,
      tdee: null,
      requiresInput: opts?.requiresInput ?? false,
      message: opts?.message ?? null,
      disclaimer:
        'Nilai nutrisi adalah estimasi. Bukan diagnosis atau pengganti konsultasi tenaga kesehatan.',
    };
  }
}
