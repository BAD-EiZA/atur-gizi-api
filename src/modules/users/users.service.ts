import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthClaims } from '../../common/auth/auth.types';
import { AppException } from '../../common/errors/app.exception';
import { HttpStatus } from '@nestjs/common';
import { PatchProfileDto, PatchSettingsDto } from './dto/profile.dto';
import { computeTarget } from '../../common/utils/nutrition.util';
import { ageFromDob, parseDateOnly } from '../../common/utils/date.util';
import { ConfigService } from '@nestjs/config';
import { FitnessGoal } from '@prisma/client';

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
          metabolicFormula: dto.metabolicFormula,
          activityLevel: dto.activityLevel,
          fitnessGoal: dto.fitnessGoal,
          targetRate: dto.targetRate,
        },
      });
    });

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
      },
    });
    return this.me(appUserId);
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
    return this.prisma.dailyTarget.create({
      data: {
        userId: appUserId,
        effectiveFrom: input.effectiveFrom,
        bmrKcal: computed.bmrKcal,
        tdeeKcal: computed.tdeeKcal,
        calorieTarget: computed.calorieTarget,
        goal: input.goal,
        calculationMethod: computed.calculationMethod,
        calculationInputs: computed.calculationInputs as object,
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
          }
        : null,
    };
  }
}
