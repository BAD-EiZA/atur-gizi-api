import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ActivitySource, Intensity, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/errors/app.exception';
import {
  AnalyzeActivityScreenshotDto,
  CreateActivityLogDto,
  EstimateActivityDto,
  UpdateActivityLogDto,
} from './dto/activity.dto';
import {
  ACTIVITY_FORMULA_VERSION,
  ActivityIntensity,
  calcActivityCalories,
  calcDeviceOrMetCalories,
  metFromHeartRate,
  resolveActivityMet,
  strengthVolumeCalories,
} from '../../common/utils/nutrition.util';
import {
  metFromSpeedKmh,
  paceFamilyFromSlug,
  speedKmhFromDistance,
} from '../../common/utils/activity-met-tables';
import { ageFromDob, localDateString, parseDateOnly } from '../../common/utils/date.util';
import { MediaService } from '../media/media.service';
import { GeminiClient } from '../ai/gemini.client';

const GUESS_TO_SLUG: Record<string, string[]> = {
  walking: ['walking', 'walking-brisk', 'walking-slow'],
  running: ['running', 'running-easy', 'running-tempo', 'running-fast'],
  cycling: ['cycling', 'cycling-leisure', 'cycling-moderate', 'cycling-vigorous'],
  swimming: ['swimming', 'swimming-leisure', 'swimming-laps'],
  strength: ['strength', 'strength-light', 'strength-hard', 'bodyweight'],
  hiit: ['hiit'],
  yoga: ['yoga', 'yoga-power'],
  hiking: ['hiking', 'hiking-uphill'],
  other: ['other'],
};

@Injectable()
export class ActivitiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly media: MediaService,
    private readonly gemini: GeminiClient,
    private readonly config: ConfigService,
  ) {}

  async listTypes() {
    const rows = await this.prisma.activityType.findMany({
      where: { active: true },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
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

  private async consumeAiQuota(userId: string) {
    const settings = await this.prisma.userSettings.findUnique({ where: { userId } });
    const tz = settings?.timezone ?? 'Asia/Jakarta';
    const usageDate = parseDateOnly(localDateString(new Date(), tz));
    const quota = this.config.get<number>('gemini.dailyQuota') ?? 10;

    const row = await this.prisma.aiUsageDaily.upsert({
      where: { userId_usageDate: { userId, usageDate } },
      create: { userId, usageDate, count: 0 },
      update: {},
    });

    if (row.count >= quota) {
      throw new AppException(
        'AI_QUOTA_EXCEEDED',
        `Kuota AI harian (${quota}) sudah habis. Coba lagi besok atau catat manual.`,
        HttpStatus.TOO_MANY_REQUESTS,
        [{ reason: 'daily_quota', field: 'quota' }],
      );
    }

    await this.prisma.aiUsageDaily.update({
      where: { id: row.id },
      data: { count: { increment: 1 } },
    });

    return { used: row.count + 1, quota, remaining: quota - row.count - 1 };
  }

  /** OCR/vision draft from fitness app screenshot — user must confirm before save. */
  async analyzeScreenshot(userId: string, dto: AnalyzeActivityScreenshotDto) {
    if (!dto.cloudinaryPublicId && !dto.imageBase64) {
      throw new AppException(
        'IMAGE_REQUIRED',
        'Unggah screenshot aktivitas terlebih dahulu.',
        HttpStatus.BAD_REQUEST,
      );
    }
    if (dto.cloudinaryPublicId) {
      this.media.assertOwnedPublicId(userId, dto.cloudinaryPublicId);
    }

    const quota = await this.consumeAiQuota(userId);

    let imageBase64 = dto.imageBase64;
    let mimeType = dto.mimeType ?? 'image/jpeg';
    if (!imageBase64 && dto.cloudinaryPublicId) {
      const fetched = await this.media.fetchAsBase64(dto.cloudinaryPublicId);
      if (fetched) {
        imageBase64 = fetched.data;
        mimeType = fetched.mimeType;
      }
    }
    if (!imageBase64) {
      throw new AppException(
        'AI_IMAGE_UNAVAILABLE',
        'Screenshot tidak dapat dibaca. Coba unggah ulang.',
        HttpStatus.BAD_REQUEST,
      );
    }

    let raw;
    try {
      raw = await this.gemini.analyzeActivityScreenshot({ imageBase64, mimeType });
    } catch {
      throw new AppException(
        'AI_PROVIDER_ERROR',
        'Gagal membaca screenshot. Coba lagi atau catat manual.',
        HttpStatus.BAD_GATEWAY,
      );
    }

    // best-effort delete after analysis (privacy)
    if (dto.cloudinaryPublicId) {
      const settings = await this.prisma.userSettings.findUnique({ where: { userId } });
      if (!settings?.retainFoodPhotos) {
        try {
          await this.media.destroy(dto.cloudinaryPublicId);
        } catch {
          /* ignore */
        }
      }
    }

    const duration =
      raw.duration_minutes != null && raw.duration_minutes > 0
        ? Math.max(1, Math.round(raw.duration_minutes))
        : null;
    const calories =
      raw.calories_burned != null && raw.calories_burned >= 0
        ? Math.round(raw.calories_burned)
        : null;
    const distanceM =
      raw.distance_m != null && raw.distance_m > 0 ? Math.round(raw.distance_m) : null;
    const avgHr =
      raw.avg_hr != null && raw.avg_hr >= 60 && raw.avg_hr <= 220
        ? Math.round(raw.avg_hr)
        : null;

    const type = await this.resolveTypeFromGuess(raw.activity_type_guess);

    return {
      draft: {
        is_activity_screen: Boolean(raw.is_activity_screen),
        detected_app: raw.detected_app ?? 'unknown',
        activity_name: raw.activity_name?.trim() || type?.name || 'Aktivitas',
        activity_type_id: type?.id ?? null,
        activity_type_slug: type?.slug ?? null,
        activity_type_guess: raw.activity_type_guess ?? 'other',
        duration_minutes: duration,
        calories_burned: calories,
        distance_m: distanceM,
        distance_km: distanceM != null ? Math.round((distanceM / 1000) * 100) / 100 : null,
        avg_hr: avgHr,
        started_at: raw.started_at,
        intensity: raw.intensity_guess ?? 'moderate',
        confidence: raw.confidence ?? 0,
        image_quality: raw.image_quality ?? 'usable',
        needs_user_input: Boolean(raw.needs_user_input) || !raw.is_activity_screen,
        fields_found: raw.fields_found ?? [],
        warnings: raw.warnings ?? [],
      },
      disclaimer:
        'Hasil AI dari screenshot adalah draf. Periksa angka sebelum menyimpan. Bukan data resmi perangkat.',
      quota,
    };
  }

  private async resolveTypeFromGuess(guess?: string | null) {
    const keys = GUESS_TO_SLUG[guess ?? 'other'] ?? GUESS_TO_SLUG.other;
    for (const slug of keys!) {
      const t = await this.prisma.activityType.findFirst({
        where: { slug, active: true },
      });
      if (t) return t;
    }
    return this.prisma.activityType.findFirst({ where: { slug: 'other', active: true } });
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

  private async ageYears(userId: string): Promise<number> {
    const p = await this.prisma.userProfile.findUnique({ where: { userId } });
    if (!p?.dateOfBirth) return 30;
    try {
      return ageFromDob(p.dateOfBirth);
    } catch {
      return 30;
    }
  }

  private async sexFactor(userId: string): Promise<'a' | 'b' | undefined> {
    const p = await this.prisma.userProfile.findUnique({ where: { userId } });
    if (p?.sex === 'male' || p?.metabolicFormula === 'mifflin_a') return 'a';
    if (p?.sex === 'female' || p?.metabolicFormula === 'mifflin_b') return 'b';
    return undefined;
  }

  private resolveMetFor(input: {
    defaultMet?: number | null;
    metOverride?: number | null;
    intensity?: Intensity | null;
    distanceM?: number | null;
    durationMinutes: number;
    slug?: string | null;
    avgHr?: number | null;
    weightKg: number;
    ageYears: number;
    preferHr?: boolean;
    sexFactor?: 'a' | 'b';
  }) {
    let paceMet: number | null = null;
    if (input.distanceM != null && input.distanceM > 0) {
      const speed = speedKmhFromDistance(Number(input.distanceM), input.durationMinutes);
      const family = paceFamilyFromSlug(input.slug);
      if (speed != null && family) {
        paceMet = metFromSpeedKmh(family, speed);
      }
    }
    let hrMet: number | null = null;
    if (input.avgHr != null) {
      hrMet = metFromHeartRate({
        avgHr: input.avgHr,
        weightKg: input.weightKg,
        ageYears: input.ageYears,
        durationMinutes: input.durationMinutes,
        sexFactor: input.sexFactor,
      });
    }
    return resolveActivityMet({
      defaultMet: input.defaultMet,
      metOverride: input.metOverride,
      intensity: (input.intensity ?? 'moderate') as ActivityIntensity,
      paceMet,
      hrMet,
      preferHr: Boolean(input.preferHr) && !input.metOverride && !paceMet,
    });
  }

  async estimate(userId: string, dto: EstimateActivityDto) {
    let defaultMet: number | null = null;
    let slug: string | null = null;
    if (dto.activityTypeId) {
      const t = await this.prisma.activityType.findFirst({
        where: { id: dto.activityTypeId, active: true },
      });
      if (!t) {
        throw new AppException(
          'ACTIVITY_TYPE_NOT_FOUND',
          'Jenis aktivitas tidak ditemukan.',
          HttpStatus.NOT_FOUND,
        );
      }
      defaultMet = Number(t.defaultMet);
      slug = t.slug;
    }
    if (dto.metValue == null && defaultMet == null) {
      throw new AppException('MET_REQUIRED', 'Nilai MET atau jenis aktivitas diperlukan.', HttpStatus.BAD_REQUEST);
    }
    const weight = await this.weightKg(userId, dto.weightKg);
    const age = await this.ageYears(userId);
    const sex = await this.sexFactor(userId);
    const resolved = this.resolveMetFor({
      defaultMet,
      metOverride: dto.metValue,
      intensity: dto.intensity ?? Intensity.moderate,
      distanceM: dto.distanceM,
      durationMinutes: dto.durationMinutes,
      sexFactor: sex,
      slug,
      avgHr: dto.avgHr,
      weightKg: weight,
      ageYears: age,
      preferHr: Boolean(dto.avgHr) && !dto.metValue && !(dto.distanceM && dto.distanceM > 0),
    });
    const calories = calcActivityCalories(resolved.met, weight, dto.durationMinutes);
    const speed =
      dto.distanceM != null && dto.distanceM > 0
        ? speedKmhFromDistance(dto.distanceM, dto.durationMinutes)
        : null;
    return {
      met_value: resolved.met,
      met_source: resolved.source,
      weight_kg: weight,
      duration_minutes: dto.durationMinutes,
      intensity: dto.intensity ?? Intensity.moderate,
      distance_m: dto.distanceM ?? null,
      speed_kmh: speed != null ? Math.round(speed * 10) / 10 : null,
      avg_hr: dto.avgHr ?? null,
      calculated_calories: calories,
      formula_version: ACTIVITY_FORMULA_VERSION,
    };
  }

  async create(userId: string, dto: CreateActivityLogDto) {
    let defaultMet: number | null = null;
    let typeId = dto.activityTypeId ?? null;
    let slug: string | null = null;
    if (typeId) {
      const t = await this.prisma.activityType.findFirst({
        where: { id: typeId, active: true },
      });
      if (!t) {
        throw new AppException(
          'ACTIVITY_TYPE_NOT_FOUND',
          'Jenis aktivitas tidak ditemukan.',
          HttpStatus.NOT_FOUND,
        );
      }
      defaultMet = Number(t.defaultMet);
      slug = t.slug;
    }
    if (!typeId && !dto.customName) {
      throw new AppException(
        'ACTIVITY_NAME_REQUIRED',
        'activityTypeId atau customName wajib.',
        HttpStatus.BAD_REQUEST,
      );
    }
    if (dto.metValue == null && defaultMet == null) {
      defaultMet = 4;
    }

    const weight = await this.weightKg(userId);
    const age = await this.ageYears(userId);
    const sex = await this.sexFactor(userId);
    const intensity = dto.intensity ?? Intensity.moderate;
    const resolved = this.resolveMetFor({
      defaultMet,
      metOverride: dto.metValue,
      intensity,
      distanceM: dto.distanceM,
      durationMinutes: dto.durationMinutes,
      slug,
      avgHr: dto.avgHr,
      weightKg: weight,
      ageYears: age,
      sexFactor: sex,
      preferHr: Boolean(dto.avgHr) && !dto.metValue && !(dto.distanceM && dto.distanceM > 0),
    });

    let calculated = calcDeviceOrMetCalories({
      met: resolved.met,
      weightKg: weight,
      durationMinutes: dto.durationMinutes,
      deviceCalories: dto.deviceCalories,
    });
    if (dto.deviceCalories == null && (dto.sets || dto.reps)) {
      calculated = strengthVolumeCalories({
        metCalories: calculated,
        sets: dto.sets,
        reps: dto.reps,
        loadKg: dto.loadKg,
        bodyWeightKg: weight,
        durationMinutes: dto.durationMinutes,
      });
    }
    const burned = dto.caloriesBurned ?? calculated;
    const source =
      dto.source ??
      (dto.deviceCalories != null
        ? ActivitySource.device
        : dto.metValue != null
          ? ActivitySource.manual
          : ActivitySource.estimate);

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
        intensity,
        metValue: resolved.met,
        weightSnapshotKg: weight,
        calculatedCalories: calculated,
        caloriesBurned: burned,
        formulaVersion: ACTIVITY_FORMULA_VERSION,
        notes: dto.notes,
        distanceM: dto.distanceM,
        rpe: dto.rpe,
        avgHr: dto.avgHr,
        sets: dto.sets,
        reps: dto.reps,
        loadKg: dto.loadKg,
        source,
        deviceCalories: dto.deviceCalories,
        metSource: resolved.source,
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
      include: { activityType: true },
    });
    if (!existing) {
      throw new AppException('ACTIVITY_LOG_NOT_FOUND', 'Log aktivitas tidak ditemukan.', HttpStatus.NOT_FOUND);
    }

    const duration = dto.durationMinutes ?? existing.durationMinutes;
    const intensity = dto.intensity ?? existing.intensity;
    const distanceM =
      dto.distanceM !== undefined
        ? dto.distanceM
        : existing.distanceM != null
          ? Number(existing.distanceM)
          : null;
    const avgHr = dto.avgHr !== undefined ? dto.avgHr : existing.avgHr;
    const weight = Number(existing.weightSnapshotKg);
    const age = await this.ageYears(userId);
    const sex = await this.sexFactor(userId);
    const sets = dto.sets !== undefined ? dto.sets : existing.sets;
    const reps = dto.reps !== undefined ? dto.reps : existing.reps;
    const loadKg =
      dto.loadKg !== undefined
        ? dto.loadKg
        : existing.loadKg != null
          ? Number(existing.loadKg)
          : null;

    const resolved = this.resolveMetFor({
      defaultMet: existing.activityType ? Number(existing.activityType.defaultMet) : Number(existing.metValue),
      metOverride: dto.metValue ?? null,
      intensity,
      distanceM,
      durationMinutes: duration,
      slug: existing.activityType?.slug,
      avgHr,
      weightKg: weight,
      ageYears: age,
      sexFactor: sex,
      preferHr: Boolean(avgHr) && dto.metValue == null && !(distanceM && distanceM > 0),
    });

    // keep frozen met if only notes change and no effort fields
    const effortChanged =
      dto.durationMinutes != null ||
      dto.intensity != null ||
      dto.distanceM !== undefined ||
      dto.avgHr !== undefined ||
      dto.metValue != null ||
      dto.sets !== undefined ||
      dto.reps !== undefined ||
      dto.loadKg !== undefined;
    const met = effortChanged ? resolved.met : Number(existing.metValue);
    const metSource = effortChanged ? resolved.source : existing.metSource;

    let calculated = calcActivityCalories(met, weight, duration);
    if (existing.source !== 'device' && (sets || reps)) {
      calculated = strengthVolumeCalories({
        metCalories: calculated,
        sets,
        reps,
        loadKg,
        bodyWeightKg: weight,
        durationMinutes: duration,
      });
    }
    // preserve device kcal unless user overrides burned
    const burned =
      dto.caloriesBurned ??
      (existing.deviceCalories != null ? existing.deviceCalories : calculated);

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
        intensity,
        metValue: met,
        calculatedCalories: calculated,
        caloriesBurned: burned,
        notes: dto.notes,
        startedAt: startedAt ?? undefined,
        logDate,
        distanceM: dto.distanceM !== undefined ? dto.distanceM : undefined,
        rpe: dto.rpe !== undefined ? dto.rpe : undefined,
        avgHr: dto.avgHr !== undefined ? dto.avgHr : undefined,
        sets: dto.sets !== undefined ? dto.sets : undefined,
        reps: dto.reps !== undefined ? dto.reps : undefined,
        loadKg: dto.loadKg !== undefined ? dto.loadKg : undefined,
        metSource: metSource ?? undefined,
        formulaVersion: effortChanged ? ACTIVITY_FORMULA_VERSION : existing.formulaVersion,
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

  /** Import device activities (wearable sync). */
  async importDeviceActivities(
    userId: string,
    items: Array<{
      name?: string;
      activityTypeSlug?: string;
      durationMinutes: number;
      caloriesBurned?: number;
      distanceM?: number;
      avgHr?: number;
      startedAt?: string;
      intensity?: Intensity;
    }>,
  ) {
    const created: string[] = [];
    for (const item of items) {
      if (!(item.durationMinutes > 0)) continue;
      let typeId: string | undefined;
      if (item.activityTypeSlug) {
        const t = await this.prisma.activityType.findFirst({
          where: { slug: item.activityTypeSlug, active: true },
        });
        typeId = t?.id;
      }
      const log = await this.create(userId, {
        activityTypeId: typeId,
        customName: typeId ? undefined : item.name || 'Aktivitas perangkat',
        durationMinutes: item.durationMinutes,
        caloriesBurned: item.caloriesBurned,
        deviceCalories: item.caloriesBurned,
        distanceM: item.distanceM,
        avgHr: item.avgHr,
        startedAt: item.startedAt,
        intensity: item.intensity ?? Intensity.moderate,
        source: ActivitySource.device,
        notes: item.name ? `Impor: ${item.name}` : 'Impor wearable',
      });
      created.push(log.id);
    }
    return { imported: created.length, ids: created };
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
    distanceM?: Prisma.Decimal | null;
    rpe?: number | null;
    avgHr?: number | null;
    sets?: number | null;
    reps?: number | null;
    loadKg?: Prisma.Decimal | null;
    source?: ActivitySource | null;
    deviceCalories?: number | null;
    metSource?: string | null;
    activityType: { id: string; name: string; slug: string; category?: string } | null;
  }) {
    const distanceM = log.distanceM != null ? Number(log.distanceM) : null;
    const speed =
      distanceM != null && distanceM > 0
        ? speedKmhFromDistance(distanceM, log.durationMinutes)
        : null;
    return {
      id: log.id,
      log_date: log.logDate.toISOString().slice(0, 10),
      started_at: log.startedAt?.toISOString() ?? null,
      duration_minutes: log.durationMinutes,
      intensity: log.intensity,
      met_value: Number(log.metValue),
      met_source: log.metSource ?? null,
      weight_snapshot_kg: Number(log.weightSnapshotKg),
      calculated_calories: log.calculatedCalories,
      calories_burned: log.caloriesBurned,
      formula_version: log.formulaVersion,
      notes: log.notes,
      distance_m: distanceM,
      speed_kmh: speed != null ? Math.round(speed * 10) / 10 : null,
      rpe: log.rpe ?? null,
      avg_hr: log.avgHr ?? null,
      sets: log.sets ?? null,
      reps: log.reps ?? null,
      load_kg: log.loadKg != null ? Number(log.loadKg) : null,
      source: log.source ?? 'estimate',
      device_calories: log.deviceCalories ?? null,
      name: log.activityType?.name ?? log.customName ?? 'Aktivitas',
      activity_type: log.activityType
        ? {
            id: log.activityType.id,
            name: log.activityType.name,
            slug: log.activityType.slug,
            category: log.activityType.category,
          }
        : null,
    };
  }
}
