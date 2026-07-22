import { HttpStatus, Injectable } from '@nestjs/common';
import {
  NutritionGoalMethod,
  NutritionGoalStatus,
  NutritionGoalType,
  NutritionPreviewStatus,
  NutritionValueSource,
  Prisma,
  ScreeningAnswer,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import { AppException } from '../../common/errors/app.exception';
import {
  ageFromDob,
  localDateString,
  parseDateOnly,
} from '../../common/utils/date.util';
import {
  confirmationTextVersionFor,
  equationSexFromProfile,
  evaluateCompletionEligibility,
  hashContext,
  computeGoalPlan,
  type GoalPlanInput,
  type NutritionWarningCode,
} from '../../common/utils/nutrition-v2.util';
import {
  closeOpenDailyTargets,
  createDailyTargetFromNutritionGoal,
} from '../../common/utils/daily-target-sync.util';
import { trackNutritionAudit } from '../../common/audit/nutrition-audit';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ActivateGoalDto,
  CreateGoalFromPreviewDto,
  GoalPlanDto,
  ManualGoalDto,
  PreviewGoalDto,
  RecalculateGoalDto,
  UpsertScreeningDto,
} from './dto/nutrition-goal.dto';

const PREVIEW_TTL_MS = 15 * 60 * 1000;

@Injectable()
export class NutritionV2GoalsService {
  constructor(private readonly prisma: PrismaService) {}

  async getScreening(userId: string) {
    this.requireUser(userId);
    const row = await this.prisma.nutritionSafetyScreening.findUnique({
      where: { userId },
    });
    if (!row) {
      return {
        status: 'missing' as const,
        version: null,
        updatedAt: null,
        consentVersion: null,
        answers: null,
      };
    }
    return this.mapScreening(row);
  }

  async upsertScreening(userId: string, dto: UpsertScreeningDto) {
    this.requireUser(userId);
    const existing = await this.prisma.nutritionSafetyScreening.findUnique({
      where: { userId },
    });
    if (existing) {
      if (dto.expectedVersion !== existing.version) {
        throw new AppException(
          'SCREENING_VERSION_CONFLICT',
          'Versi screening sudah berubah.',
          HttpStatus.CONFLICT,
        );
      }
    } else if (dto.expectedVersion != null) {
      throw new AppException(
        'SCREENING_VERSION_CONFLICT',
        'Screening belum ada. Gunakan expectedVersion null.',
        HttpStatus.CONFLICT,
      );
    }

    const data = {
      isPregnant: dto.isPregnant,
      isBreastfeeding: dto.isBreastfeeding,
      hasKidneyDisease: dto.hasKidneyDisease,
      hasLiverDisease: dto.hasLiverDisease,
      hasHeartFailureOrFluidRetention: dto.hasHeartFailureOrFluidRetention,
      usesHypoglycemiaRiskMedication: dto.usesHypoglycemiaRiskMedication,
      hasEatingDisorderHistory: dto.hasEatingDisorderHistory,
      consentVersion: dto.consentVersion,
    };

    const row = existing
      ? await this.prisma.nutritionSafetyScreening.update({
          where: { userId },
          data: { ...data, version: existing.version + 1 },
        })
      : await this.prisma.nutritionSafetyScreening.create({
          data: { userId, ...data, version: 1 },
        });

    await this.prisma.nutritionPreview.updateMany({
      where: { userId, status: NutritionPreviewStatus.unused },
      data: {
        status: NutritionPreviewStatus.invalidated,
        invalidatedAt: new Date(),
      },
    });

    await trackNutritionAudit(this.prisma, {
      userId,
      action: 'nutrition_screening_updated',
      entityType: 'nutrition_safety_screenings',
      entityId: row.id,
      metadata: { screeningVersion: row.version },
    });

    return this.mapScreening(row);
  }

  async deleteScreening(userId: string) {
    this.requireUser(userId);
    await this.prisma.$transaction(async (tx) => {
      await tx.nutritionPreview.updateMany({
        where: { userId, status: NutritionPreviewStatus.unused },
        data: {
          status: NutritionPreviewStatus.invalidated,
          invalidatedAt: new Date(),
        },
      });
      await tx.nutritionSafetyScreening.deleteMany({ where: { userId } });
      await trackNutritionAudit(tx, {
        userId,
        action: 'nutrition_screening_deleted',
        entityType: 'nutrition_safety_screenings',
        metadata: {},
      });
    });
    return { deleted: true };
  }

  async previewGoal(userId: string, dto: PreviewGoalDto) {
    const ctx = await this.loadProfileContext(userId);
    const screening = await this.prisma.nutritionSafetyScreening.findUnique({
      where: { userId },
    });
    const goal = this.toGoalPlanInput(dto.goal);
    const plan = computeGoalPlan({
      weightKg: ctx.weightKg,
      heightCm: ctx.heightCm,
      ageYears: ctx.ageYears,
      equationSex: ctx.equationSex!,
      activityLevel: ctx.activityLevel!,
      calculationLocalDate: ctx.localDate,
      goal,
      screening: screening
        ? {
            isPregnant: screening.isPregnant,
            isBreastfeeding: screening.isBreastfeeding,
            hasKidneyDisease: screening.hasKidneyDisease,
            hasLiverDisease: screening.hasLiverDisease,
            hasHeartFailureOrFluidRetention:
              screening.hasHeartFailureOrFluidRetention,
            usesHypoglycemiaRiskMedication:
              screening.usesHypoglycemiaRiskMedication,
            hasEatingDisorderHistory: screening.hasEatingDisorderHistory,
          }
        : null,
    });

    if ('errorCode' in plan && plan.errorCode) {
      throw new AppException(
        plan.errorCode,
        'Goal tidak valid.',
        HttpStatus.BAD_REQUEST,
      );
    }
    if (!ctx.equationSex || !ctx.activityLevel) {
      throw new AppException(
        'EQUATION_SEX_REQUIRED',
        'Lengkapi profil biologis dan aktivitas.',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    if (!screening) {
      const decision = plan.decision;
      return {
        previewId: null,
        available: false,
        decision: {
          ...decision,
          blockingCodes: [
            ...new Set([...decision.blockingCodes, 'SCREENING_INCOMPLETE']),
          ],
          automaticPlanAllowed: false,
          severity: 'block' as const,
        },
        expectedConfirmationTextVersion: confirmationTextVersionFor(
          decision.warningCodes,
        ),
        bmi: plan.basics && 'bmi' in plan.basics ? plan.basics.bmi : null,
        ree: null,
        tdee: null,
        goal: plan.goal,
        calories: null,
        expiresAt: null,
      };
    }

    const safeInput = {
      weightKg: ctx.weightKg,
      heightCm: ctx.heightCm,
      ageYears: ctx.ageYears,
      equationSex: ctx.equationSex,
      activityLevel: ctx.activityLevel,
      goal,
      calculationLocalDate: ctx.localDate,
      timezone: ctx.timezone,
      screeningRecordId: screening.id,
      screeningVersion: screening.version,
    };
    const inputHash = hashContext(safeInput);
    const issuedAt = new Date();
    const expiresAt = new Date(issuedAt.getTime() + PREVIEW_TTL_MS);
    const output = {
      available: plan.available,
      decision: plan.decision,
      basics: plan.basics,
      goal: plan.goal,
      calories: plan.calories,
      formulaVersions: plan.available ? plan.formulaVersions : undefined,
      rulesetVersions: plan.decision.rulesetVersions,
    };

    const preview = await this.prisma.nutritionPreview.create({
      data: {
        userId,
        status: NutritionPreviewStatus.unused,
        inputHash,
        screeningRecordId: screening.id,
        screeningVersion: screening.version,
        calculationLocalDate: parseDateOnly(ctx.localDate),
        timezone: ctx.timezone,
        formulaVersions: plan.available ? plan.formulaVersions : {},
        rulesetVersions: plan.decision.rulesetVersions,
        warningCodes: plan.decision.warningCodes,
        blockingCodes: plan.decision.blockingCodes,
        safeInputSnapshot: safeInput,
        outputSnapshot: output as unknown as Prisma.InputJsonValue,
        expiresAt,
      },
    });

    return {
      previewId: preview.id,
      issuedAt: issuedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
      calculationLocalDate: ctx.localDate,
      available: plan.available && plan.decision.automaticPlanAllowed,
      decision: plan.decision,
      expectedConfirmationTextVersion: confirmationTextVersionFor(
        plan.decision.warningCodes,
      ),
      bmi:
        plan.basics && 'bmi' in plan.basics && plan.basics
          ? plan.basics.bmi
          : null,
      ree:
        plan.basics && 'ree' in plan.basics && plan.basics
          ? {
              kcalPerDay: plan.basics.ree.kcalPerDay,
              valueSource: plan.basics.ree.valueSource,
              formulaVersion: plan.basics.ree.formulaVersion,
            }
          : null,
      tdee:
        plan.basics && 'tdee' in plan.basics && plan.basics
          ? {
              kcalPerDay: plan.basics.tdee.kcalPerDay,
              activityLevel: plan.basics.tdee.activityLevel,
              activityMultiplier: plan.basics.tdee.activityMultiplier,
              valueSource: plan.basics.tdee.valueSource,
              formulaVersion: plan.basics.tdee.formulaVersion,
            }
          : null,
      goal: plan.goal,
      calories: plan.calories,
      formulaVersions: plan.available ? plan.formulaVersions : null,
      rulesetVersions: plan.decision.rulesetVersions,
    };
  }

  async createGoalFromPreview(userId: string, dto: CreateGoalFromPreviewDto) {
    this.requireUser(userId);
    return this.prisma.$transaction(async (tx) => {
      const preview = await tx.nutritionPreview.findFirst({
        where: { id: dto.previewId, userId },
      });
      if (!preview) {
        throw new AppException(
          'PREVIEW_NOT_FOUND',
          'Preview tidak ditemukan.',
          HttpStatus.NOT_FOUND,
        );
      }
      if (preview.status !== NutritionPreviewStatus.unused) {
        throw new AppException(
          'PREVIEW_ALREADY_USED',
          'Preview sudah dipakai atau tidak valid.',
          HttpStatus.CONFLICT,
        );
      }
      if (preview.expiresAt.getTime() <= Date.now()) {
        await tx.nutritionPreview.update({
          where: { id: preview.id },
          data: { status: NutritionPreviewStatus.expired },
        });
        throw new AppException(
          'PREVIEW_EXPIRED',
          'Preview kedaluwarsa.',
          HttpStatus.CONFLICT,
        );
      }

      const screening = await tx.nutritionSafetyScreening.findUnique({
        where: { userId },
      });
      if (
        !screening ||
        screening.id !== preview.screeningRecordId ||
        screening.version !== preview.screeningVersion
      ) {
        throw new AppException(
          'PREVIEW_STALE',
          'Screening berubah sejak preview.',
          HttpStatus.CONFLICT,
        );
      }

      const blocking = preview.blockingCodes as string[];
      if (Array.isArray(blocking) && blocking.length > 0) {
        throw new AppException(
          'AUTOMATIC_PLAN_BLOCKED',
          'Target otomatis diblokir.',
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }

      const safe = preview.safeInputSnapshot as {
        weightKg: number;
        heightCm: number;
        goal: GoalPlanInput;
        activityLevel: string;
      };
      const out = preview.outputSnapshot as {
        goal?: {
          type: string;
          method: string;
          targetWeightKg: number | null;
          weeklyChangeKg: number | null;
          targetDate: string | null;
          estimatedWeeks: number | null;
          feasibility: string | null;
          targetBmi: number | null;
        };
        calories?: {
          targetKcalPerDay: number;
          dailyAdjustmentKcal: number;
        } | null;
        basics?: {
          bmi?: { value: number };
          ree?: { kcalPerDay: number };
          tdee?: {
            kcalPerDay: number;
            activityMultiplier: number;
            activityLevel: string;
          };
        };
        decision?: {
          warningCodes: string[];
          blockingCodes: string[];
          automaticPlanAllowed: boolean;
        };
      };

      const id = randomUUID();
      const type = this.mapGoalType(out.goal?.type ?? 'maintain');
      const method = this.mapGoalMethod(out.goal?.method ?? 'maintenance');
      const goal = await tx.nutritionGoal.create({
        data: {
          id,
          userId,
          rootGoalId: id,
          parentGoalId: null,
          revisionNumber: 1,
          type,
          method,
          status: NutritionGoalStatus.draft,
          source: 'automatic',
          valueSource: NutritionValueSource.estimated,
          startWeightKg: safe.weightKg,
          targetWeightKg: out.goal?.targetWeightKg ?? null,
          weeklyChangeKg: out.goal?.weeklyChangeKg ?? null,
          targetDate: out.goal?.targetDate
            ? parseDateOnly(out.goal.targetDate)
            : null,
          estimatedWeeks: out.goal?.estimatedWeeks ?? null,
          bmi: out.basics?.bmi?.value ?? null,
          targetBmi: out.goal?.targetBmi ?? null,
          reeKcalPerDay: out.basics?.ree?.kcalPerDay ?? null,
          tdeeKcalPerDay: out.basics?.tdee?.kcalPerDay ?? null,
          targetCaloriesPerDay: out.calories?.targetKcalPerDay ?? null,
          activityLevel: (out.basics?.tdee?.activityLevel ??
            safe.activityLevel) as never,
          activityMultiplier: out.basics?.tdee?.activityMultiplier ?? null,
          feasibility: out.goal?.feasibility ?? null,
          formulaVersions: preview.formulaVersions as Prisma.InputJsonValue,
          rulesetVersions: preview.rulesetVersions as Prisma.InputJsonValue,
          warningCodes: preview.warningCodes as Prisma.InputJsonValue,
          blockingCodes: preview.blockingCodes as Prisma.InputJsonValue,
          automaticPlanAllowed: out.decision?.automaticPlanAllowed ?? false,
          screeningRecordId: screening.id,
          screeningVersion: screening.version,
          profileHash: preview.inputHash,
          safetyEvaluatedAt: new Date(),
          safeInputSnapshot: preview.safeInputSnapshot as Prisma.InputJsonValue,
          outputSnapshot: preview.outputSnapshot as Prisma.InputJsonValue,
        },
      });

      await tx.nutritionPreview.update({
        where: { id: preview.id },
        data: {
          status: NutritionPreviewStatus.consumed,
          consumedAt: new Date(),
        },
      });

      await trackNutritionAudit(tx, {
        userId,
        action: 'nutrition_goal_drafted',
        entityType: 'nutrition_goals',
        entityId: goal.id,
        metadata: {
          goalId: goal.id,
          rootGoalId: goal.rootGoalId,
          revisionNumber: goal.revisionNumber,
          warningCount: Array.isArray(goal.warningCodes)
            ? goal.warningCodes.length
            : 0,
          blockingCount: Array.isArray(goal.blockingCodes)
            ? goal.blockingCodes.length
            : 0,
        },
      });

      return {
        goal: {
          id: goal.id,
          rootGoalId: goal.rootGoalId,
          parentGoalId: goal.parentGoalId,
          revisionNumber: goal.revisionNumber,
          origin: 'nutrition_v2',
          source: goal.source,
          valueSource: goal.valueSource,
          type: out.goal?.type ?? 'maintain',
          method: out.goal?.method ?? 'maintenance',
          status: goal.status,
          warningCodes: goal.warningCodes,
          blockingCodes: goal.blockingCodes,
          createdAt: goal.createdAt.toISOString(),
        },
      };
    });
  }

  async activateGoal(userId: string, goalId: string, dto: ActivateGoalDto) {
    this.requireUser(userId);
    return this.prisma.$transaction(async (tx) => {
      const goal = await tx.nutritionGoal.findFirst({
        where: { id: goalId, userId },
      });
      if (!goal) {
        throw new AppException(
          'GOAL_NOT_FOUND',
          'Goal tidak ditemukan.',
          HttpStatus.NOT_FOUND,
        );
      }
      if (goal.status !== NutritionGoalStatus.draft) {
        throw new AppException(
          'GOAL_STATUS_INVALID',
          'Hanya draft yang dapat diaktifkan.',
          HttpStatus.CONFLICT,
        );
      }

      const screening = await tx.nutritionSafetyScreening.findUnique({
        where: { userId },
      });
      if (
        !screening ||
        screening.id !== goal.screeningRecordId ||
        screening.version !== goal.screeningVersion
      ) {
        throw new AppException(
          'DRAFT_STALE',
          'Screening/profil berubah. Buat preview baru.',
          HttpStatus.CONFLICT,
        );
      }

      const warningCodes = (goal.warningCodes as string[]) ?? [];
      const accepted = [...dto.acceptedWarningCodes].sort();
      const expected = [...warningCodes].sort();
      if (JSON.stringify(accepted) !== JSON.stringify(expected)) {
        throw new AppException(
          'WARNING_ACCEPTANCE_MISMATCH',
          'Penerimaan warning tidak cocok.',
          HttpStatus.CONFLICT,
        );
      }
      const expectedText = confirmationTextVersionFor(
        warningCodes as NutritionWarningCode[],
      );
      if (dto.confirmationTextVersion !== expectedText) {
        throw new AppException(
          'CONFIRMATION_TEXT_VERSION_INVALID',
          'Versi teks konfirmasi tidak valid.',
          HttpStatus.CONFLICT,
        );
      }
      if (
        warningCodes.includes('GOAL_RATE_AGGRESSIVE') &&
        dto.aggressiveRiskAccepted !== true
      ) {
        throw new AppException(
          'WARNING_ACCEPTANCE_MISMATCH',
          'Konfirmasi aggressive wajib.',
          HttpStatus.CONFLICT,
        );
      }

      const now = new Date();
      const profile = await tx.userProfile.findUnique({ where: { userId } });
      const settings = await tx.userSettings.findUnique({ where: { userId } });
      const tz = settings?.timezone ?? 'Asia/Jakarta';
      const today = parseDateOnly(localDateString(now, tz));

      await tx.nutritionGoal.updateMany({
        where: {
          userId,
          status: {
            in: [
              NutritionGoalStatus.active,
              NutritionGoalStatus.eligible_for_completion,
            ],
          },
        },
        data: {
          status: NutritionGoalStatus.replaced,
          replacedAt: now,
        },
      });

      const activated = await tx.nutritionGoal.update({
        where: { id: goal.id },
        data: {
          status: NutritionGoalStatus.active,
          activatedAt: now,
        },
      });

      await tx.nutritionGoalAcceptance.create({
        data: {
          userId,
          goalId: goal.id,
          acceptedWarningCodes: dto.acceptedWarningCodes,
          aggressiveRiskAccepted: dto.aggressiveRiskAccepted === true,
          confirmationTextVersion: dto.confirmationTextVersion,
          rulesetVersions: goal.rulesetVersions as Prisma.InputJsonValue,
        },
      });

      if (activated.targetCaloriesPerDay != null) {
        const fitnessGoal =
          profile?.fitnessGoal ?? this.mapFitnessGoalFromType(activated.type);
        const weightKg =
          profile?.currentWeightKg != null
            ? Number(profile.currentWeightKg)
            : Number(activated.startWeightKg);
        await createDailyTargetFromNutritionGoal(tx, {
          userId,
          effectiveFrom: today,
          goalId: activated.id,
          fitnessGoal,
          reeKcalPerDay:
            activated.reeKcalPerDay != null
              ? Number(activated.reeKcalPerDay)
              : null,
          tdeeKcalPerDay:
            activated.tdeeKcalPerDay != null
              ? Number(activated.tdeeKcalPerDay)
              : null,
          targetCaloriesPerDay: Number(activated.targetCaloriesPerDay),
          weightKg,
          formulaVersions: activated.formulaVersions,
          rulesetVersions: activated.rulesetVersions,
        });
      } else {
        await closeOpenDailyTargets(tx, userId, today);
      }

      await trackNutritionAudit(tx, {
        userId,
        action: 'nutrition_goal_activated',
        entityType: 'nutrition_goals',
        entityId: activated.id,
        metadata: {
          goalId: activated.id,
          rootGoalId: activated.rootGoalId,
          revisionNumber: activated.revisionNumber,
          warningCount: warningCodes.length,
          hasAggressive: warningCodes.includes('GOAL_RATE_AGGRESSIVE'),
          confirmationTextVersion: dto.confirmationTextVersion,
          status: activated.status,
        },
      });

      return {
        goal: {
          id: activated.id,
          status: activated.status,
          activatedAt: activated.activatedAt?.toISOString() ?? null,
        },
      };
    });
  }

  async cancelGoal(userId: string, goalId: string) {
    this.requireUser(userId);
    return this.prisma.$transaction(async (tx) => {
      const goal = await tx.nutritionGoal.findFirst({
        where: { id: goalId, userId },
      });
      if (!goal) {
        throw new AppException(
          'GOAL_NOT_FOUND',
          'Goal tidak ditemukan.',
          HttpStatus.NOT_FOUND,
        );
      }
      const cancellable: NutritionGoalStatus[] = [
        NutritionGoalStatus.draft,
        NutritionGoalStatus.active,
        NutritionGoalStatus.eligible_for_completion,
      ];
      if (!cancellable.includes(goal.status)) {
        throw new AppException(
          'GOAL_STATUS_INVALID',
          'Status goal tidak dapat dibatalkan.',
          HttpStatus.CONFLICT,
        );
      }

      const wasRunning =
        goal.status === NutritionGoalStatus.active ||
        goal.status === NutritionGoalStatus.eligible_for_completion;

      const updated = await tx.nutritionGoal.update({
        where: { id: goalId },
        data: {
          status: NutritionGoalStatus.cancelled,
          cancelledAt: new Date(),
        },
      });

      if (wasRunning) {
        const settings = await tx.userSettings.findUnique({
          where: { userId },
        });
        const tz = settings?.timezone ?? 'Asia/Jakarta';
        const today = parseDateOnly(localDateString(new Date(), tz));
        await closeOpenDailyTargets(tx, userId, today, {
          onlyNutritionGoalId: goal.id,
        });
      }

      await trackNutritionAudit(tx, {
        userId,
        action: 'nutrition_goal_cancelled',
        entityType: 'nutrition_goals',
        entityId: updated.id,
        metadata: { goalId: updated.id, status: updated.status },
      });

      return {
        goal: {
          id: updated.id,
          status: updated.status,
          cancelledAt: updated.cancelledAt?.toISOString() ?? null,
        },
      };
    });
  }

  async currentGoal(userId: string) {
    this.requireUser(userId);
    const goal = await this.prisma.nutritionGoal.findFirst({
      where: {
        userId,
        status: {
          in: [
            NutritionGoalStatus.active,
            NutritionGoalStatus.eligible_for_completion,
          ],
        },
      },
      orderBy: { activatedAt: 'desc' },
    });
    if (!goal) return { goal: null };
    return {
      goal: {
        id: goal.id,
        origin: 'nutrition_v2',
        nutritionVersion: 'v2',
        source: goal.source,
        valueSource: goal.valueSource,
        status: goal.status,
        type: this.reverseGoalType(goal.type),
        method: this.reverseGoalMethod(goal.method),
        targetWeightKg:
          goal.targetWeightKg != null ? Number(goal.targetWeightKg) : null,
        targetKcalPerDay:
          goal.targetCaloriesPerDay != null
            ? Number(goal.targetCaloriesPerDay)
            : null,
        feasibility: goal.feasibility,
        formulaVersions: goal.formulaVersions,
        activatedAt: goal.activatedAt?.toISOString() ?? null,
      },
    };
  }

  async recalculateGoal(
    userId: string,
    parentGoalId: string,
    dto: RecalculateGoalDto,
  ) {
    this.requireUser(userId);
    return this.prisma.$transaction(async (tx) => {
      const parent = await tx.nutritionGoal.findFirst({
        where: { id: parentGoalId, userId },
      });
      if (!parent) {
        throw new AppException(
          'GOAL_NOT_FOUND',
          'Goal tidak ditemukan.',
          HttpStatus.NOT_FOUND,
        );
      }
      const allowedParents: NutritionGoalStatus[] = [
        NutritionGoalStatus.active,
        NutritionGoalStatus.eligible_for_completion,
      ];
      if (!allowedParents.includes(parent.status)) {
        throw new AppException(
          'GOAL_STATUS_INVALID',
          'Recalculate hanya dari goal running.',
          HttpStatus.CONFLICT,
        );
      }

      const preview = await tx.nutritionPreview.findFirst({
        where: { id: dto.previewId, userId },
      });
      if (!preview) {
        throw new AppException(
          'PREVIEW_NOT_FOUND',
          'Preview tidak ditemukan.',
          HttpStatus.NOT_FOUND,
        );
      }
      if (preview.status !== NutritionPreviewStatus.unused) {
        throw new AppException(
          'PREVIEW_ALREADY_USED',
          'Preview sudah dipakai atau tidak valid.',
          HttpStatus.CONFLICT,
        );
      }
      if (preview.expiresAt.getTime() <= Date.now()) {
        await tx.nutritionPreview.update({
          where: { id: preview.id },
          data: { status: NutritionPreviewStatus.expired },
        });
        throw new AppException(
          'PREVIEW_EXPIRED',
          'Preview kedaluwarsa.',
          HttpStatus.CONFLICT,
        );
      }

      const screening = await tx.nutritionSafetyScreening.findUnique({
        where: { userId },
      });
      if (
        !screening ||
        screening.id !== preview.screeningRecordId ||
        screening.version !== preview.screeningVersion
      ) {
        throw new AppException(
          'PREVIEW_STALE',
          'Screening berubah sejak preview.',
          HttpStatus.CONFLICT,
        );
      }

      const blocking = preview.blockingCodes as string[];
      if (Array.isArray(blocking) && blocking.length > 0) {
        throw new AppException(
          'AUTOMATIC_PLAN_BLOCKED',
          'Target otomatis diblokir.',
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }

      const latest = await tx.nutritionGoal.findFirst({
        where: { rootGoalId: parent.rootGoalId },
        orderBy: { revisionNumber: 'desc' },
      });
      const nextRevision =
        (latest?.revisionNumber ?? parent.revisionNumber) + 1;
      const safe = preview.safeInputSnapshot as {
        weightKg: number;
        heightCm: number;
        activityLevel: string;
      };
      const out = preview.outputSnapshot as {
        goal?: {
          type: string;
          method: string;
          targetWeightKg: number | null;
          weeklyChangeKg: number | null;
          targetDate: string | null;
          estimatedWeeks: number | null;
          feasibility: string | null;
          targetBmi: number | null;
        };
        calories?: { targetKcalPerDay: number } | null;
        basics?: {
          bmi?: { value: number };
          ree?: { kcalPerDay: number };
          tdee?: {
            kcalPerDay: number;
            activityMultiplier: number;
            activityLevel: string;
          };
        };
        decision?: { automaticPlanAllowed: boolean };
      };

      const id = randomUUID();
      const goal = await tx.nutritionGoal.create({
        data: {
          id,
          userId,
          rootGoalId: parent.rootGoalId,
          parentGoalId: parent.id,
          replacesGoalId: parent.id,
          revisionNumber: nextRevision,
          type: this.mapGoalType(out.goal?.type ?? 'maintain'),
          method: this.mapGoalMethod(out.goal?.method ?? 'maintenance'),
          status: NutritionGoalStatus.draft,
          source: 'automatic',
          valueSource: NutritionValueSource.estimated,
          startWeightKg: safe.weightKg,
          targetWeightKg: out.goal?.targetWeightKg ?? null,
          weeklyChangeKg: out.goal?.weeklyChangeKg ?? null,
          targetDate: out.goal?.targetDate
            ? parseDateOnly(out.goal.targetDate)
            : null,
          estimatedWeeks: out.goal?.estimatedWeeks ?? null,
          bmi: out.basics?.bmi?.value ?? null,
          targetBmi: out.goal?.targetBmi ?? null,
          reeKcalPerDay: out.basics?.ree?.kcalPerDay ?? null,
          tdeeKcalPerDay: out.basics?.tdee?.kcalPerDay ?? null,
          targetCaloriesPerDay: out.calories?.targetKcalPerDay ?? null,
          activityLevel: (out.basics?.tdee?.activityLevel ??
            safe.activityLevel) as never,
          activityMultiplier: out.basics?.tdee?.activityMultiplier ?? null,
          feasibility: out.goal?.feasibility ?? null,
          formulaVersions: preview.formulaVersions as Prisma.InputJsonValue,
          rulesetVersions: preview.rulesetVersions as Prisma.InputJsonValue,
          warningCodes: preview.warningCodes as Prisma.InputJsonValue,
          blockingCodes: preview.blockingCodes as Prisma.InputJsonValue,
          automaticPlanAllowed: out.decision?.automaticPlanAllowed ?? false,
          screeningRecordId: screening.id,
          screeningVersion: screening.version,
          profileHash: preview.inputHash,
          safetyEvaluatedAt: new Date(),
          safeInputSnapshot: preview.safeInputSnapshot as Prisma.InputJsonValue,
          outputSnapshot: preview.outputSnapshot as Prisma.InputJsonValue,
        },
      });

      await tx.nutritionPreview.update({
        where: { id: preview.id },
        data: {
          status: NutritionPreviewStatus.consumed,
          consumedAt: new Date(),
        },
      });

      await trackNutritionAudit(tx, {
        userId,
        action: 'nutrition_goal_recalculated',
        entityType: 'nutrition_goals',
        entityId: goal.id,
        metadata: {
          goalId: goal.id,
          rootGoalId: goal.rootGoalId,
          parentGoalId: parent.id,
          revisionNumber: goal.revisionNumber,
          status: goal.status,
        },
      });

      return {
        goal: {
          id: goal.id,
          rootGoalId: goal.rootGoalId,
          parentGoalId: goal.parentGoalId,
          revisionNumber: goal.revisionNumber,
          origin: 'nutrition_v2',
          source: goal.source,
          valueSource: goal.valueSource,
          type: out.goal?.type ?? 'maintain',
          method: out.goal?.method ?? 'maintenance',
          status: goal.status,
          warningCodes: goal.warningCodes,
          blockingCodes: goal.blockingCodes,
          createdAt: goal.createdAt.toISOString(),
        },
      };
    });
  }

  async reevaluateCompletion(userId: string, goalId?: string) {
    this.requireUser(userId);
    const settings = await this.prisma.userSettings.findUnique({
      where: { userId },
    });
    const tz = settings?.timezone ?? 'Asia/Jakarta';
    const goal = goalId
      ? await this.prisma.nutritionGoal.findFirst({
          where: { id: goalId, userId },
        })
      : await this.prisma.nutritionGoal.findFirst({
          where: {
            userId,
            status: {
              in: [
                NutritionGoalStatus.active,
                NutritionGoalStatus.eligible_for_completion,
              ],
            },
          },
          orderBy: { activatedAt: 'desc' },
        });
    if (!goal) {
      throw new AppException(
        'GOAL_NOT_FOUND',
        'Goal running tidak ditemukan.',
        HttpStatus.NOT_FOUND,
      );
    }
    const running: NutritionGoalStatus[] = [
      NutritionGoalStatus.active,
      NutritionGoalStatus.eligible_for_completion,
    ];
    if (!running.includes(goal.status)) {
      throw new AppException(
        'GOAL_STATUS_INVALID',
        'Hanya goal running yang dievaluasi.',
        HttpStatus.CONFLICT,
      );
    }

    const goalType = this.reverseGoalType(goal.type);
    const logs = await this.prisma.weightLog.findMany({
      where: {
        userId,
        ...(goal.activatedAt ? { loggedAt: { gte: goal.activatedAt } } : {}),
      },
      orderBy: { loggedAt: 'asc' },
      take: 120,
    });
    const evalResult = evaluateCompletionEligibility({
      goalType: goalType as 'lose' | 'gain' | 'maintain' | 'manual',
      targetWeightKg:
        goal.targetWeightKg != null ? Number(goal.targetWeightKg) : null,
      activatedAt: goal.activatedAt,
      timezone: tz,
      weightLogs: logs.map((l) => ({
        id: l.id,
        weightKg: Number(l.weightKg),
        loggedAt: l.loggedAt,
      })),
    });

    let status = goal.status;
    let completionEligibleAt = goal.completionEligibleAt;
    if (evalResult.eligible && goal.status === NutritionGoalStatus.active) {
      status = NutritionGoalStatus.eligible_for_completion;
      completionEligibleAt = new Date();
    } else if (
      !evalResult.eligible &&
      goal.status === NutritionGoalStatus.eligible_for_completion
    ) {
      status = NutritionGoalStatus.active;
      completionEligibleAt = null;
    }

    const updated = await this.prisma.nutritionGoal.update({
      where: { id: goal.id },
      data: {
        status,
        completionEligibleAt,
        outputSnapshot: {
          ...(typeof goal.outputSnapshot === 'object' &&
          goal.outputSnapshot &&
          !Array.isArray(goal.outputSnapshot)
            ? (goal.outputSnapshot as Record<string, unknown>)
            : {}),
          completionEvidence: {
            eligible: evalResult.eligible,
            evidenceWeightLogIds: evalResult.evidenceWeightLogIds,
            qualifyingLocalDates: evalResult.qualifyingLocalDates,
            evaluatedAt: new Date().toISOString(),
          },
        },
      },
    });

    if (
      status === NutritionGoalStatus.eligible_for_completion &&
      goal.status !== NutritionGoalStatus.eligible_for_completion
    ) {
      await trackNutritionAudit(this.prisma, {
        userId,
        action: 'nutrition_goal_completion_eligible',
        entityType: 'nutrition_goals',
        entityId: updated.id,
        metadata: {
          goalId: updated.id,
          eligible: true,
          evidenceCount: evalResult.evidenceWeightLogIds.length,
          status: updated.status,
        },
      });
    }

    return {
      goal: {
        id: updated.id,
        status: updated.status,
        completionEligibleAt:
          updated.completionEligibleAt?.toISOString() ?? null,
        evidenceWeightLogIds: evalResult.evidenceWeightLogIds,
        qualifyingLocalDates: evalResult.qualifyingLocalDates,
        eligible: evalResult.eligible,
      },
    };
  }

  async confirmCompletion(userId: string, goalId: string) {
    this.requireUser(userId);
    const evaluated = await this.reevaluateCompletion(userId, goalId);
    if (!evaluated.goal.eligible) {
      throw new AppException(
        'GOAL_STATUS_INVALID',
        'Goal belum eligible untuk completion.',
        HttpStatus.CONFLICT,
      );
    }
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.nutritionGoal.update({
        where: { id: goalId },
        data: {
          status: NutritionGoalStatus.completed,
          completedAt: new Date(),
        },
      });
      const settings = await tx.userSettings.findUnique({ where: { userId } });
      const tz = settings?.timezone ?? 'Asia/Jakarta';
      const today = parseDateOnly(localDateString(new Date(), tz));
      await closeOpenDailyTargets(tx, userId, today, {
        onlyNutritionGoalId: goalId,
      });
      await trackNutritionAudit(tx, {
        userId,
        action: 'nutrition_goal_completed',
        entityType: 'nutrition_goals',
        entityId: updated.id,
        metadata: {
          goalId: updated.id,
          status: updated.status,
          evidenceCount: evaluated.goal.evidenceWeightLogIds.length,
        },
      });
      return {
        goal: {
          id: updated.id,
          status: updated.status,
          completedAt: updated.completedAt?.toISOString() ?? null,
          evidenceWeightLogIds: evaluated.goal.evidenceWeightLogIds,
        },
      };
    });
  }

  async listGoals(userId: string, cursor?: string, limit = 20) {
    this.requireUser(userId);
    const take = Math.min(Math.max(limit, 1), 50);

    type HistoryItem = {
      id: string;
      origin: 'legacy_v1' | 'nutrition_v2';
      nutritionVersion: 'v1' | 'v2';
      source: string;
      valueSource: string | null;
      status: string;
      type: string;
      method: string | null;
      rootGoalId: string | null;
      parentGoalId: string | null;
      revisionNumber: number | null;
      targetWeightKg: number | null;
      targetKcalPerDay: number | null;
      createdAt: string;
      activatedAt: string | null;
      completedAt: string | null;
      sortAt: number;
      sortOrigin: number;
    };

    const [v2Rows, v1Rows] = await Promise.all([
      this.prisma.nutritionGoal.findMany({
        where: { userId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 200,
      }),
      this.prisma.dailyTarget.findMany({
        where: {
          userId,
          NOT: { calculationMethod: { startsWith: 'nutrition_v2' } },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 200,
      }),
    ]);

    const items: HistoryItem[] = [
      ...v2Rows.map((goal) => ({
        id: goal.id,
        origin: 'nutrition_v2' as const,
        nutritionVersion: 'v2' as const,
        source: goal.source,
        valueSource: goal.valueSource,
        status: goal.status,
        type: this.reverseGoalType(goal.type),
        method: this.reverseGoalMethod(goal.method),
        rootGoalId: goal.rootGoalId,
        parentGoalId: goal.parentGoalId,
        revisionNumber: goal.revisionNumber,
        targetWeightKg:
          goal.targetWeightKg != null ? Number(goal.targetWeightKg) : null,
        targetKcalPerDay:
          goal.targetCaloriesPerDay != null
            ? Number(goal.targetCaloriesPerDay)
            : null,
        createdAt: goal.createdAt.toISOString(),
        activatedAt: goal.activatedAt?.toISOString() ?? null,
        completedAt: goal.completedAt?.toISOString() ?? null,
        sortAt: goal.createdAt.getTime(),
        sortOrigin: 0,
      })),
      ...v1Rows.map((row) => ({
        id: row.id,
        origin: 'legacy_v1' as const,
        nutritionVersion: 'v1' as const,
        source: 'automatic',
        valueSource: null,
        status: row.effectiveTo == null ? 'active' : 'replaced',
        type: row.goal,
        method: row.calculationMethod,
        rootGoalId: null,
        parentGoalId: null,
        revisionNumber: null,
        targetWeightKg: null,
        targetKcalPerDay: row.calorieTarget,
        createdAt: row.createdAt.toISOString(),
        activatedAt: row.effectiveFrom.toISOString(),
        completedAt: row.effectiveTo?.toISOString() ?? null,
        sortAt: row.createdAt.getTime(),
        sortOrigin: 1,
      })),
    ];

    items.sort((a, b) => {
      if (b.sortAt !== a.sortAt) return b.sortAt - a.sortAt;
      if (a.sortOrigin !== b.sortOrigin) return a.sortOrigin - b.sortOrigin;
      return b.id.localeCompare(a.id);
    });

    let start = 0;
    if (cursor) {
      const [ts, origin, id] = cursor.split('|');
      const cursorAt = Number(ts);
      const cursorOrigin = origin === 'legacy_v1' ? 1 : 0;
      start = items.findIndex(
        (item) =>
          item.sortAt < cursorAt ||
          (item.sortAt === cursorAt &&
            (item.sortOrigin > cursorOrigin ||
              (item.sortOrigin === cursorOrigin && item.id < id))),
      );
      if (start < 0) start = items.length;
    }

    const page = items.slice(start, start + take);
    const hasMore = start + take < items.length;
    const last = page[page.length - 1];
    return {
      data: page.map((item) => {
        const { sortAt: _sortAt, sortOrigin: _sortOrigin, ...rest } = item;
        void _sortAt;
        void _sortOrigin;
        return rest;
      }),
      nextCursor:
        hasMore && last ? `${last.sortAt}|${last.origin}|${last.id}` : null,
    };
  }

  async createManualGoal(userId: string, dto: ManualGoalDto) {
    const ctx = await this.loadProfileContext(userId);
    const source = ctx.ageYears < 20 ? 'manual_adolescent' : 'manual_adult';
    const id = randomUUID();
    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      await tx.nutritionGoal.updateMany({
        where: {
          userId,
          status: {
            in: [
              NutritionGoalStatus.active,
              NutritionGoalStatus.eligible_for_completion,
            ],
          },
        },
        data: { status: NutritionGoalStatus.replaced, replacedAt: now },
      });
      const today = parseDateOnly(ctx.localDate);
      await closeOpenDailyTargets(tx, userId, today);
      const goal = await tx.nutritionGoal.create({
        data: {
          id,
          userId,
          rootGoalId: id,
          revisionNumber: 1,
          type: NutritionGoalType.manual,
          method: NutritionGoalMethod.manual,
          status: NutritionGoalStatus.active,
          source,
          valueSource: NutritionValueSource.manual,
          startWeightKg: ctx.weightKg,
          targetWeightKg: dto.targetWeightKg,
          automaticPlanAllowed: false,
          formulaVersions: {},
          rulesetVersions: {},
          warningCodes: [],
          blockingCodes: [],
          safeInputSnapshot: {
            targetWeightKg: dto.targetWeightKg,
            noteCode: dto.noteCode ?? 'personal_goal',
            source,
          },
          outputSnapshot: {
            labelCode: 'PERSONAL_GOAL_NOT_RECOMMENDATION',
          },
          activatedAt: now,
        },
      });
      await trackNutritionAudit(tx, {
        userId,
        action: 'nutrition_goal_activated',
        entityType: 'nutrition_goals',
        entityId: goal.id,
        metadata: {
          goalId: goal.id,
          source,
          status: goal.status,
        },
      });
      return {
        goal: {
          id: goal.id,
          origin: 'nutrition_v2',
          source: goal.source,
          valueSource: goal.valueSource,
          status: goal.status,
          targetWeightKg: Number(goal.targetWeightKg),
          labelCode: 'PERSONAL_GOAL_NOT_RECOMMENDATION',
        },
      };
    });
  }

  private mapScreening(row: {
    id: string;
    version: number;
    updatedAt: Date;
    consentVersion: string;
    isPregnant: ScreeningAnswer;
    isBreastfeeding: ScreeningAnswer;
    hasKidneyDisease: ScreeningAnswer;
    hasLiverDisease: ScreeningAnswer;
    hasHeartFailureOrFluidRetention: ScreeningAnswer;
    usesHypoglycemiaRiskMedication: ScreeningAnswer;
    hasEatingDisorderHistory: ScreeningAnswer;
  }) {
    return {
      status: 'complete' as const,
      id: row.id,
      version: row.version,
      updatedAt: row.updatedAt.toISOString(),
      consentVersion: row.consentVersion,
      answers: {
        isPregnant: row.isPregnant,
        isBreastfeeding: row.isBreastfeeding,
        hasKidneyDisease: row.hasKidneyDisease,
        hasLiverDisease: row.hasLiverDisease,
        hasHeartFailureOrFluidRetention: row.hasHeartFailureOrFluidRetention,
        usesHypoglycemiaRiskMedication: row.usesHypoglycemiaRiskMedication,
        hasEatingDisorderHistory: row.hasEatingDisorderHistory,
      },
    };
  }

  private toGoalPlanInput(dto: GoalPlanDto): GoalPlanInput {
    if (dto.type === 'maintain') return { type: 'maintain' };
    if (!dto.method || dto.targetWeightKg == null) {
      throw new AppException(
        'INVALID_INPUT',
        'method dan targetWeightKg wajib untuk lose/gain.',
        HttpStatus.BAD_REQUEST,
      );
    }
    if (dto.method === 'weekly_rate') {
      if (dto.weeklyChangeKg == null) {
        throw new AppException(
          'INVALID_INPUT',
          'weeklyChangeKg wajib.',
          HttpStatus.BAD_REQUEST,
        );
      }
      return {
        type: dto.type,
        method: 'weekly_rate',
        targetWeightKg: dto.targetWeightKg,
        weeklyChangeKg: dto.weeklyChangeKg,
      };
    }
    if (!dto.targetDate) {
      throw new AppException(
        'INVALID_INPUT',
        'targetDate wajib.',
        HttpStatus.BAD_REQUEST,
      );
    }
    return {
      type: dto.type,
      method: 'target_date',
      targetWeightKg: dto.targetWeightKg,
      targetDate: dto.targetDate.slice(0, 10),
    };
  }

  private mapGoalType(type: string): NutritionGoalType {
    if (type === 'lose') return NutritionGoalType.lose_weight;
    if (type === 'gain') return NutritionGoalType.gain_weight;
    if (type === 'manual') return NutritionGoalType.manual;
    return NutritionGoalType.maintain;
  }

  private mapGoalMethod(method: string): NutritionGoalMethod {
    if (method === 'weekly_rate') return NutritionGoalMethod.weekly_rate;
    if (method === 'target_date') return NutritionGoalMethod.target_date;
    if (method === 'manual') return NutritionGoalMethod.manual;
    return NutritionGoalMethod.maintenance;
  }

  private reverseGoalType(type: NutritionGoalType): string {
    if (type === NutritionGoalType.lose_weight) return 'lose';
    if (type === NutritionGoalType.gain_weight) return 'gain';
    if (type === NutritionGoalType.manual) return 'manual';
    return 'maintain';
  }

  private reverseGoalMethod(method: NutritionGoalMethod): string {
    return method;
  }

  private mapFitnessGoalFromType(
    type: NutritionGoalType,
  ): 'lose_weight' | 'maintain' | 'gain_weight' | 'manual' {
    if (type === NutritionGoalType.lose_weight) return 'lose_weight';
    if (type === NutritionGoalType.gain_weight) return 'gain_weight';
    if (type === NutritionGoalType.manual) return 'manual';
    return 'maintain';
  }

  private requireUser(userId: string) {
    if (!userId) {
      throw new AppException(
        'USER_NOT_SYNCED',
        'Panggil /v1/users/sync terlebih dahulu.',
        HttpStatus.NOT_FOUND,
      );
    }
  }

  private async loadProfileContext(userId: string) {
    this.requireUser(userId);
    const user = await this.prisma.appUser.findUnique({
      where: { id: userId },
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
    if (!p.dateOfBirth || p.currentWeightKg == null || p.heightCm == null) {
      throw new AppException(
        'PROFILE_OUTSIDE_SUPPORTED_RANGE',
        'Lengkapi profil.',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    const tz = user.settings?.timezone ?? 'Asia/Jakarta';
    return {
      weightKg: Number(p.currentWeightKg),
      heightCm: Number(p.heightCm),
      ageYears: ageFromDob(p.dateOfBirth),
      equationSex: equationSexFromProfile(p.sex, p.metabolicFormula),
      activityLevel: p.activityLevel,
      timezone: tz,
      localDate: localDateString(new Date(), tz),
    };
  }
}
