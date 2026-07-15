import { HttpStatus, Injectable } from '@nestjs/common';
import { Intensity, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/errors/app.exception';
import {
  CreateActivityLogDto,
  EstimateActivityDto,
  UpdateActivityLogDto,
} from './dto/activity.dto';
import {
  ACTIVITY_FORMULA_VERSION,
  calcActivityCalories,
} from '../../common/utils/nutrition.util';
import { localDateString, parseDateOnly } from '../../common/utils/date.util';

@Injectable()
export class ActivitiesService {
  constructor(private readonly prisma: PrismaService) {}

  async listTypes() {
    const rows = await this.prisma.activityType.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
    });
    return {
      data: rows.map((r) => ({
        id: r.id,
        slug: r.slug,
        name: r.name,
        category: r.category,
        default_met: Number(r.defaultMet),
      })),
    };
  }

  private async weightKg(userId: string, override?: number) {
    if (override != null) return override;
    const p = await this.prisma.userProfile.findUnique({ where: { userId } });
    if (!p?.currentWeightKg) {
      throw new AppException(
        'WEIGHT_REQUIRED',
        'Berat badan profil diperlukan untuk estimasi aktivitas.',
        HttpStatus.BAD_REQUEST,
      );
    }
    return Number(p.currentWeightKg);
  }

  async estimate(userId: string, dto: EstimateActivityDto) {
    let met = dto.metValue;
    if (!met && dto.activityTypeId) {
      const t = await this.prisma.activityType.findFirst({
        where: { id: dto.activityTypeId, active: true },
      });
      if (!t) {
        throw new AppException('ACTIVITY_TYPE_NOT_FOUND', 'Jenis aktivitas tidak ditemukan.', HttpStatus.NOT_FOUND);
      }
      met = Number(t.defaultMet);
    }
    if (!met) {
      throw new AppException('MET_REQUIRED', 'Nilai MET diperlukan.', HttpStatus.BAD_REQUEST);
    }
    const weight = await this.weightKg(userId, dto.weightKg);
    const calories = calcActivityCalories(met, weight, dto.durationMinutes);
    return {
      met_value: met,
      weight_kg: weight,
      duration_minutes: dto.durationMinutes,
      calculated_calories: calories,
      formula_version: ACTIVITY_FORMULA_VERSION,
    };
  }

  async create(userId: string, dto: CreateActivityLogDto) {
    let met = dto.metValue;
    let typeId = dto.activityTypeId ?? null;
    if (typeId) {
      const t = await this.prisma.activityType.findFirst({
        where: { id: typeId, active: true },
      });
      if (!t) {
        throw new AppException('ACTIVITY_TYPE_NOT_FOUND', 'Jenis aktivitas tidak ditemukan.', HttpStatus.NOT_FOUND);
      }
      met = met ?? Number(t.defaultMet);
    }
    if (!met) {
      throw new AppException('MET_REQUIRED', 'Nilai MET diperlukan.', HttpStatus.BAD_REQUEST);
    }
    if (!typeId && !dto.customName) {
      throw new AppException(
        'ACTIVITY_NAME_REQUIRED',
        'activityTypeId atau customName wajib.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const weight = await this.weightKg(userId);
    const calculated = calcActivityCalories(met, weight, dto.durationMinutes);
    const burned = dto.caloriesBurned ?? calculated;
    const settings = await this.prisma.userSettings.findUnique({ where: { userId } });
    const tz = settings?.timezone ?? 'Asia/Jakarta';
    const startedAt = dto.startedAt ? new Date(dto.startedAt) : new Date();
    const logDate = dto.logDate
      ? parseDateOnly(dto.logDate)
      : parseDateOnly(localDateString(startedAt, tz));

    const log = await this.prisma.activityLog.create({
      data: {
        userId,
        activityTypeId: typeId,
        customName: dto.customName,
        logDate,
        startedAt,
        durationMinutes: dto.durationMinutes,
        intensity: dto.intensity ?? Intensity.moderate,
        metValue: met,
        weightSnapshotKg: weight,
        calculatedCalories: calculated,
        caloriesBurned: burned,
        formulaVersion: ACTIVITY_FORMULA_VERSION,
        notes: dto.notes,
      },
      include: { activityType: true },
    });
    return this.serialize(log);
  }

  async list(userId: string, query: { from?: string; to?: string; cursor?: string; limit?: number }) {
    const limit = Math.min(query.limit ?? 20, 50);
    const where: Prisma.ActivityLogWhereInput = {
      userId,
      deletedAt: null,
      ...(query.from || query.to
        ? {
            logDate: {
              ...(query.from ? { gte: parseDateOnly(query.from) } : {}),
              ...(query.to ? { lte: parseDateOnly(query.to) } : {}),
            },
          }
        : {}),
    };
    const items = await this.prisma.activityLog.findMany({
      where,
      take: limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      orderBy: [{ logDate: 'desc' }, { startedAt: 'desc' }],
      include: { activityType: true },
    });
    let nextCursor: string | null = null;
    if (items.length > limit) {
      const next = items.pop()!;
      nextCursor = next.id;
    }
    return { data: items.map((i) => this.serialize(i)), next_cursor: nextCursor };
  }

  async get(userId: string, id: string) {
    const log = await this.prisma.activityLog.findFirst({
      where: { id, userId, deletedAt: null },
      include: { activityType: true },
    });
    if (!log) {
      throw new AppException('ACTIVITY_LOG_NOT_FOUND', 'Log aktivitas tidak ditemukan.', HttpStatus.NOT_FOUND);
    }
    return this.serialize(log);
  }

  async update(userId: string, id: string, dto: UpdateActivityLogDto) {
    const existing = await this.prisma.activityLog.findFirst({
      where: { id, userId, deletedAt: null },
    });
    if (!existing) {
      throw new AppException('ACTIVITY_LOG_NOT_FOUND', 'Log aktivitas tidak ditemukan.', HttpStatus.NOT_FOUND);
    }
    const duration = dto.durationMinutes ?? existing.durationMinutes;
    const met = Number(existing.metValue);
    const weight = Number(existing.weightSnapshotKg);
    const calculated = calcActivityCalories(met, weight, duration);
    const burned = dto.caloriesBurned ?? calculated;

    const settings = await this.prisma.userSettings.findUnique({ where: { userId } });
    const tz = settings?.timezone ?? 'Asia/Jakarta';
    const startedAt = dto.startedAt ? new Date(dto.startedAt) : existing.startedAt;
    const logDate = startedAt
      ? parseDateOnly(localDateString(startedAt, tz))
      : existing.logDate;

    const log = await this.prisma.activityLog.update({
      where: { id },
      data: {
        durationMinutes: duration,
        intensity: dto.intensity,
        calculatedCalories: calculated,
        caloriesBurned: burned,
        notes: dto.notes,
        startedAt: startedAt ?? undefined,
        logDate,
      },
      include: { activityType: true },
    });
    return this.serialize(log);
  }

  async remove(userId: string, id: string) {
    const existing = await this.prisma.activityLog.findFirst({
      where: { id, userId, deletedAt: null },
    });
    if (!existing) {
      throw new AppException('ACTIVITY_LOG_NOT_FOUND', 'Log aktivitas tidak ditemukan.', HttpStatus.NOT_FOUND);
    }
    await this.prisma.activityLog.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return { ok: true };
  }

  private serialize(log: {
    id: string;
    logDate: Date;
    startedAt: Date | null;
    durationMinutes: number;
    intensity: Intensity;
    metValue: Prisma.Decimal;
    weightSnapshotKg: Prisma.Decimal;
    calculatedCalories: number;
    caloriesBurned: number;
    formulaVersion: string;
    notes: string | null;
    customName: string | null;
    activityType: { id: string; name: string; slug: string } | null;
  }) {
    return {
      id: log.id,
      log_date: log.logDate.toISOString().slice(0, 10),
      started_at: log.startedAt?.toISOString() ?? null,
      duration_minutes: log.durationMinutes,
      intensity: log.intensity,
      met_value: Number(log.metValue),
      weight_snapshot_kg: Number(log.weightSnapshotKg),
      calculated_calories: log.calculatedCalories,
      calories_burned: log.caloriesBurned,
      formula_version: log.formulaVersion,
      notes: log.notes,
      name: log.activityType?.name ?? log.customName ?? 'Aktivitas',
      activity_type: log.activityType
        ? { id: log.activityType.id, name: log.activityType.name, slug: log.activityType.slug }
        : null,
    };
  }
}
