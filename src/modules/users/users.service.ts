import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthClaims } from '../../common/auth/auth.types';
import { AppException } from '../../common/errors/app.exception';
import { HttpStatus } from '@nestjs/common';
import {
  CreateWeightLogDto,
  PatchMacroTargetsDto,
  PatchProfileDto,
  PatchSettingsDto,
} from './dto/profile.dto';
import { computeMacroTargets, computeTarget } from '../../common/utils/nutrition.util';
import { ageFromDob, localDateString, parseDateOnly } from '../../common/utils/date.util';
import { ConfigService } from '@nestjs/config';
import { BiologicalSex, FitnessGoal, MetabolicFormula } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async sync(claims: AuthClaims) {
    const displayName =
      claims.name ||
      [claims.given_name, claims.family_name].filter(Boolean).join(' ') ||
      claims.email ||
      null;

    const user = await this.prisma.appUser.upsert({
      where: { kindeUserId: claims.sub },
      create: {
        kindeUserId: claims.sub,
        email: claims.email ?? null,
        displayName,
        profile: { create: {} },
        settings: { create: {} },
      },
      update: {
        email: claims.email ?? undefined,
        displayName: displayName ?? undefined,
      },
      include: { profile: true, settings: true },
    });

    return this.toMe(user);
  }

  async me(appUserId: string) {
    if (!appUserId) {
      throw new AppException('USER_NOT_SYNCED', 'Panggil /v1/users/sync terlebih dahulu.', HttpStatus.NOT_FOUND);
    }
    const user = await this.prisma.appUser.findUnique({
      where: { id: appUserId },
      include: { profile: true, settings: true },
    });
    if (!user) {
      throw new AppException('USER_NOT_FOUND', 'Pengguna tidak ditemukan.', HttpStatus.NOT_FOUND);
    }
    return this.toMe(user);
  }

  async patchProfile(appUserId: string, dto: PatchProfileDto) {
    const user = await this.prisma.appUser.findUnique({
      where: { id: appUserId },
      include: { profile: true },
    });
    if (!user?.profile) {
      throw new AppException('USER_NOT_FOUND', 'Pengguna tidak ditemukan.', HttpStatus.NOT_FOUND);
    }

    if (dto.dateOfBirth) {
      this.assertMinAge(dto.dateOfBirth);
    }

    const affectsTarget =
      dto.currentWeightKg != null ||
      dto.fitnessGoal != null ||
      dto.activityLevel != null ||
      dto.metabolicFormula != null ||
      dto.targetRate != null ||
      dto.heightCm != null ||
      dto.dateOfBirth != null ||
      dto.sex != null;

    let formula = dto.metabolicFormula;
    if (dto.sex === BiologicalSex.male && !formula) formula = MetabolicFormula.mifflin_a;
    if (dto.sex === BiologicalSex.female && !formula) formula = MetabolicFormula.mifflin_b;

    await this.prisma.$transaction(async (tx) => {
      if (dto.displayName !== undefined) {
        await tx.appUser.update({
          where: { id: appUserId },
          data: { displayName: dto.displayName },
        });
      }
      await tx.userProfile.update({
        where: { userId: appUserId },
        data: {
          dateOfBirth: dto.dateOfBirth ? parseDateOnly(dto.dateOfBirth) : undefined,
          heightCm: dto.heightCm,
          currentWeightKg: dto.currentWeightKg,
          sex: dto.sex,
          metabolicFormula: formula,
          activityLevel: dto.activityLevel,
          fitnessGoal: dto.fitnessGoal,
          targetRate: dto.targetRate,
        },
      });
      if (dto.currentWeightKg != null) {
        await tx.weightLog.create({
          data: {
            userId: appUserId,
            loggedAt: new Date(),
            weightKg: dto.currentWeightKg,
            source: 'profile',
          },
        });
      }
    });

    if (affectsTarget) {
      await this.refreshTargetFromProfile(appUserId);
    }

    return this.me(appUserId);
  }

  async patchSettings(appUserId: string, dto: PatchSettingsDto) {
    await this.prisma.userSettings.update({
      where: { userId: appUserId },
      data: {
        timezone: dto.timezone,
        unitSystem: dto.unitSystem,
        locale: dto.locale,
        retainFoodPhotos: dto.retainFoodPhotos,
        analyticsConsent: dto.analyticsConsent,
        calorieBudgetMode: dto.calorieBudgetMode,
      },
    });
    return this.me(appUserId);
  }

  async refreshTargetFromProfile(appUserId: string) {
    const user = await this.prisma.appUser.findUnique({
      where: { id: appUserId },
      include: { profile: true, settings: true },
    });
    const p = user?.profile;
    if (!p?.currentWeightKg || !p.heightCm || !p.dateOfBirth || !p.fitnessGoal) return null;
    const ageYears = ageFromDob(p.dateOfBirth);
    const weightKg = Number(p.currentWeightKg);
    const heightCm = Number(p.heightCm);
    const settings = user?.settings;
    const tz = settings?.timezone ?? 'Asia/Jakarta';
    const effectiveFrom = parseDateOnly(localDateString(new Date(), tz));
    return this.createTargetSnapshot(appUserId, {
      formula: p.metabolicFormula,
      weightKg,
      heightCm,
      ageYears,
      activityLevel: p.activityLevel,
      goal: p.fitnessGoal,
      targetRatePct: p.targetRate != null ? Number(p.targetRate) : null,
      effectiveFrom,
    });
  }

  async createWeightLog(appUserId: string, dto: CreateWeightLogDto) {
    const loggedAt = dto.loggedAt ? new Date(dto.loggedAt) : new Date();
    const row = await this.prisma.weightLog.create({
      data: {
        userId: appUserId,
        loggedAt,
        weightKg: dto.weightKg,
        note: dto.note,
        source: 'manual',
      },
    });
    await this.prisma.userProfile.update({
      where: { userId: appUserId },
      data: { currentWeightKg: dto.weightKg },
    });
    await this.refreshTargetFromProfile(appUserId);
    return {
      id: row.id,
      weight_kg: Number(row.weightKg),
      logged_at: row.loggedAt.toISOString(),
      note: row.note,
    };
  }

  async listWeightLogs(appUserId: string, limit = 30) {
    const rows = await this.prisma.weightLog.findMany({
      where: { userId: appUserId },
      orderBy: { loggedAt: 'desc' },
      take: Math.min(limit, 90),
    });
    return {
      data: rows.map((r) => ({
        id: r.id,
        weight_kg: Number(r.weightKg),
        logged_at: r.loggedAt.toISOString(),
        note: r.note,
        source: r.source,
      })),
    };
  }

  async patchMacroTargets(appUserId: string, dto: PatchMacroTargetsDto) {
    const latest = await this.prisma.dailyTarget.findFirst({
      where: { userId: appUserId, effectiveTo: null },
      orderBy: { effectiveFrom: 'desc' },
    });
    if (!latest) {
      throw new AppException(
        'NO_TARGET',
        'Belum ada target harian. Lengkapi profil/onboarding dulu.',
        HttpStatus.BAD_REQUEST,
      );
    }
    const updated = await this.prisma.dailyTarget.update({
      where: { id: latest.id },
      data: {
        proteinTargetG: dto.proteinG,
        carbsTargetG: dto.carbsG,
        fatTargetG: dto.fatG,
      },
    });
    return {
      calorie_target: updated.calorieTarget,
      protein_g: updated.proteinTargetG != null ? Number(updated.proteinTargetG) : null,
      carbs_g: updated.carbsTargetG != null ? Number(updated.carbsTargetG) : null,
      fat_g: updated.fatTargetG != null ? Number(updated.fatTargetG) : null,
    };
  }

  assertMinAge(dateOfBirth: string) {
    const dob = parseDateOnly(dateOfBirth);
    const age = ageFromDob(dob);
    const min = this.config.get<number>('minUserAge') ?? 15;
    if (age < min) {
      throw new AppException(
        'ONBOARDING_AGE_RESTRICTED',
        `Usia minimum pengguna adalah ${min} tahun.`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  async createTargetSnapshot(
    appUserId: string,
    input: {
      formula: Parameters<typeof computeTarget>[0]['formula'];
      weightKg: number;
      heightCm: number;
      ageYears: number;
      activityLevel: Parameters<typeof computeTarget>[0]['activityLevel'];
      goal: FitnessGoal;
      targetRatePct?: number | null;
      manualTarget?: number | null;
      effectiveFrom: Date;
    },
  ) {
    const computed = computeTarget(input);
    const latest = await this.prisma.dailyTarget.findFirst({
      where: { userId: appUserId, effectiveTo: null },
      orderBy: { effectiveFrom: 'desc' },
    });
    if (latest) {
      const dayBefore = new Date(input.effectiveFrom);
      dayBefore.setUTCDate(dayBefore.getUTCDate() - 1);
      await this.prisma.dailyTarget.update({
        where: { id: latest.id },
        data: { effectiveTo: dayBefore },
      });
    }
    const macros = computeMacroTargets({
      calorieTarget: computed.calorieTarget,
      weightKg: input.weightKg,
      goal: input.goal,
    });
    return this.prisma.dailyTarget.create({
      data: {
        userId: appUserId,
        effectiveFrom: input.effectiveFrom,
        bmrKcal: computed.bmrKcal,
        tdeeKcal: computed.tdeeKcal,
        calorieTarget: computed.calorieTarget,
        proteinTargetG: macros.proteinG,
        carbsTargetG: macros.carbsG,
        fatTargetG: macros.fatG,
        goal: input.goal,
        calculationMethod: computed.calculationMethod,
        calculationInputs: {
          ...computed.calculationInputs,
          macros_method: macros.method,
        } as object,
      },
    });
  }

  private toMe(user: {
    id: string;
    kindeUserId: string;
    email: string | null;
    displayName: string | null;
    status: string;
    profile: {
      dateOfBirth: Date | null;
      heightCm: { toNumber?: () => number } | number | null;
      currentWeightKg: { toNumber?: () => number } | number | null;
      sex?: string;
      metabolicFormula: string;
      activityLevel: string | null;
      fitnessGoal: string | null;
      targetRate: { toNumber?: () => number } | number | null;
      onboardingCompleted: boolean;
      estimatesAccepted: boolean;
    } | null;
    settings: {
      timezone: string;
      unitSystem: string;
      locale: string;
      retainFoodPhotos: boolean;
      analyticsConsent: boolean;
      calorieBudgetMode?: string;
    } | null;
  }) {
    const num = (v: { toNumber?: () => number } | number | null | undefined) => {
      if (v == null) return null;
      if (typeof v === 'number') return v;
      return v.toNumber ? v.toNumber() : Number(v);
    };
    return {
      id: user.id,
      kinde_user_id: user.kindeUserId,
      email: user.email,
      display_name: user.displayName,
      status: user.status,
      onboarding_completed: user.profile?.onboardingCompleted ?? false,
      profile: user.profile
        ? {
            date_of_birth: user.profile.dateOfBirth
              ? user.profile.dateOfBirth.toISOString().slice(0, 10)
              : null,
            height_cm: num(user.profile.heightCm),
            current_weight_kg: num(user.profile.currentWeightKg),
            sex: user.profile.sex ?? 'unspecified',
            metabolic_formula: user.profile.metabolicFormula,
            activity_level: user.profile.activityLevel,
            fitness_goal: user.profile.fitnessGoal,
            target_rate: num(user.profile.targetRate),
            estimates_accepted: user.profile.estimatesAccepted,
          }
        : null,
      settings: user.settings
        ? {
            timezone: user.settings.timezone,
            unit_system: user.settings.unitSystem,
            locale: user.settings.locale,
            retain_food_photos: user.settings.retainFoodPhotos,
            analytics_consent: user.settings.analyticsConsent,
            calorie_budget_mode: user.settings.calorieBudgetMode ?? 'intake_only',
          }
        : null,
    };
  }
}
