import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { MediaService } from '../media/media.service';
import { NutritionService } from '../nutrition/nutrition.service';
import { GeminiClient, GeminiFoodResult } from './gemini.client';
import { ConfirmAnalysisDto, StartAnalysisDto } from './dto/ai.dto';
import { AppException } from '../../common/errors/app.exception';
import { localDateString, parseDateOnly } from '../../common/utils/date.util';
import { confidenceLabel } from '../../common/utils/nutrition.util';

@Injectable()
export class AiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly media: MediaService,
    private readonly nutrition: NutritionService,
    private readonly gemini: GeminiClient,
    private readonly config: ConfigService,
  ) {}

  private async consumeQuota(userId: string) {
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

  normalize(raw: GeminiFoodResult) {
    const items = (raw.detected_items ?? [])
      .filter((i) => i.name?.trim() && i.estimated_calories >= 0)
      .map((i) => {
        const conf = Math.min(1, Math.max(0, Number(i.confidence) || 0));
        const calories = Math.max(0, Math.round(Number(i.estimated_calories) || 0));
        return {
          name: i.name.trim(),
          local_name: i.local_name ?? null,
          portion_amount: Math.max(0.01, Number(i.estimated_portion?.amount) || 1),
          portion_unit: i.estimated_portion?.unit || 'serving',
          calories,
          protein_g: Math.max(0, Number(i.macros?.protein_g) || 0),
          carbs_g: Math.max(0, Number(i.macros?.carbs_g) || 0),
          fat_g: Math.max(0, Number(i.macros?.fat_g) || 0),
          fiber_g: Math.max(0, Number(i.macros?.fiber_g) || 0),
          confidence: conf,
          confidence_label: confidenceLabel(conf),
          assumptions: i.assumptions ?? [],
        };
      });

    if (items.length === 0) {
      throw new AppException(
        'AI_NO_FOOD_DETECTED',
        'Tidak ada makanan terdeteksi. Coba foto lain atau input manual.',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    const recalcTotal = items.reduce((s, i) => s + i.calories, 0);
    const overall = Math.min(
      1,
      Math.max(0, Number(raw.overall_confidence) || items.reduce((s, i) => s + i.confidence, 0) / items.length),
    );

    return {
      items,
      total_estimated_calories: recalcTotal,
      overall_confidence: overall,
      overall_confidence_label: confidenceLabel(overall),
      image_quality: raw.image_quality ?? 'usable',
      needs_user_input: raw.needs_user_input ?? true,
      follow_up_questions: raw.follow_up_questions ?? [],
      warnings: [
        ...(raw.warnings ?? []),
        ...(Math.abs((raw.total_estimated_calories ?? 0) - recalcTotal) > 50
          ? ['Total kalori dihitung ulang dari item.']
          : []),
      ],
    };
  }

  async start(userId: string, dto: StartAnalysisDto) {
    this.media.assertOwnedPublicId(userId, dto.cloudinaryPublicId);
    const quota = await this.consumeQuota(userId);

    const run = await this.prisma.aiAnalysisRun.create({
      data: {
        userId,
        model: this.gemini.model,
        promptVersion: this.gemini.promptVersion,
        schemaVersion: this.gemini.schemaVersion,
        cloudinaryPublicId: dto.cloudinaryPublicId,
        mediaDeliveryType: dto.mediaDeliveryType,
        mediaVersion: dto.mediaVersion,
        mediaFormat: dto.mediaFormat,
        mediaBytes: dto.mediaBytes,
        status: 'processing',
      },
    });

    const started = Date.now();
    try {
      const imageUrl = this.media.signedDeliveryUrl(dto.cloudinaryPublicId) ?? undefined;
      const raw = await this.gemini.analyzeImage({
        imageBase64: dto.imageBase64,
        mimeType: dto.mimeType,
        imageUrl: dto.imageBase64 ? undefined : imageUrl,
      });
      const normalized = this.normalize(raw);
      const updated = await this.prisma.aiAnalysisRun.update({
        where: { id: run.id },
        data: {
          status: 'needs_review',
          latencyMs: Date.now() - started,
          overallConfidence: normalized.overall_confidence,
          normalizedOutput: normalized,
        },
      });
      return this.serialize(updated, quota);
    } catch (e) {
      const code =
        e instanceof AppException
          ? ((e.getResponse() as { error?: { code?: string } }).error?.code ?? 'AI_FAILED')
          : 'AI_PROVIDER_ERROR';
      const updated = await this.prisma.aiAnalysisRun.update({
        where: { id: run.id },
        data: {
          status: 'failed',
          latencyMs: Date.now() - started,
          failureCode: code,
        },
      });
      // auto-delete photo on hard fail (no retain)
      await this.maybeDeletePhoto(userId, dto.cloudinaryPublicId);
      if (e instanceof AppException) throw e;
      throw new AppException(
        'AI_PROVIDER_ERROR',
        'Analisis AI gagal. Coba lagi atau catat manual.',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  async get(userId: string, id: string) {
    const run = await this.prisma.aiAnalysisRun.findFirst({ where: { id, userId } });
    if (!run) {
      throw new AppException('AI_ANALYSIS_NOT_FOUND', 'Analisis tidak ditemukan.', HttpStatus.NOT_FOUND);
    }
    return this.serialize(run);
  }

  async retry(userId: string, id: string) {
    const run = await this.prisma.aiAnalysisRun.findFirst({ where: { id, userId } });
    if (!run) {
      throw new AppException('AI_ANALYSIS_NOT_FOUND', 'Analisis tidak ditemukan.', HttpStatus.NOT_FOUND);
    }
    if (run.status === 'confirmed') {
      throw new AppException('AI_ALREADY_CONFIRMED', 'Analisis sudah dikonfirmasi.', HttpStatus.CONFLICT);
    }
    const quota = await this.consumeQuota(userId);
    const started = Date.now();
    await this.prisma.aiAnalysisRun.update({
      where: { id },
      data: { status: 'processing', failureCode: null },
    });
    try {
      const imageUrl = this.media.signedDeliveryUrl(run.cloudinaryPublicId) ?? undefined;
      const raw = await this.gemini.analyzeImage({ imageUrl });
      const normalized = this.normalize(raw);
      const updated = await this.prisma.aiAnalysisRun.update({
        where: { id },
        data: {
          status: 'needs_review',
          latencyMs: Date.now() - started,
          overallConfidence: normalized.overall_confidence,
          normalizedOutput: normalized,
        },
      });
      return this.serialize(updated, quota);
    } catch (e) {
      await this.prisma.aiAnalysisRun.update({
        where: { id },
        data: {
          status: 'failed',
          latencyMs: Date.now() - started,
          failureCode: 'AI_PROVIDER_ERROR',
        },
      });
      throw new AppException(
        'AI_PROVIDER_ERROR',
        'Retry analisis gagal. Lanjut input manual.',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  async confirm(userId: string, id: string, dto: ConfirmAnalysisDto) {
    const run = await this.prisma.aiAnalysisRun.findFirst({ where: { id, userId } });
    if (!run) {
      throw new AppException('AI_ANALYSIS_NOT_FOUND', 'Analisis tidak ditemukan.', HttpStatus.NOT_FOUND);
    }
    if (run.status === 'confirmed') {
      const existing = await this.prisma.foodLog.findFirst({
        where: { aiAnalysisId: id, userId, deletedAt: null },
        include: { items: true },
      });
      if (existing) {
        return { analysis_id: id, food_log: await this.nutrition.get(userId, existing.id) };
      }
    }
    if (!['needs_review', 'succeeded', 'failed'].includes(run.status)) {
      throw new AppException(
        'AI_NOT_READY',
        'Analisis belum siap dikonfirmasi.',
        HttpStatus.CONFLICT,
      );
    }

    const settings = await this.prisma.userSettings.findUnique({ where: { userId } });
    const retain = settings?.retainFoodPhotos ?? false;

    const foodLog = await this.nutrition.create(
      userId,
      {
        consumedAt: dto.consumedAt,
        mealType: dto.mealType,
        title: dto.title ?? dto.items.map((i) => i.name).join(', '),
        items: dto.items.map((i) => ({
          name: i.name,
          portionAmount: i.portionAmount,
          portionUnit: i.portionUnit,
          calories: i.calories,
          proteinG: i.proteinG,
          carbsG: i.carbsG,
          fatG: i.fatG,
          fiberG: i.fiberG,
          aiConfidence: i.aiConfidence,
        })),
        notes: dto.notes,
      },
      'ai_confirmed',
      {
        aiAnalysisId: id,
        cloudinaryPublicId: retain ? run.cloudinaryPublicId : null,
        mediaDeliveryType: retain ? run.mediaDeliveryType : null,
      },
    );

    await this.prisma.aiAnalysisRun.update({
      where: { id },
      data: { status: 'confirmed', confirmedAt: new Date() },
    });

    if (!retain) {
      await this.media.destroy(run.cloudinaryPublicId);
    }

    return { analysis_id: id, food_log: foodLog };
  }

  async cancel(userId: string, id: string) {
    const run = await this.prisma.aiAnalysisRun.findFirst({ where: { id, userId } });
    if (!run) {
      throw new AppException('AI_ANALYSIS_NOT_FOUND', 'Analisis tidak ditemukan.', HttpStatus.NOT_FOUND);
    }
    if (run.status === 'confirmed') {
      throw new AppException('AI_ALREADY_CONFIRMED', 'Tidak dapat membatalkan analisis terkonfirmasi.', HttpStatus.CONFLICT);
    }
    await this.prisma.aiAnalysisRun.update({
      where: { id },
      data: { status: 'cancelled' },
    });
    await this.maybeDeletePhoto(userId, run.cloudinaryPublicId);
    return { ok: true };
  }

  private async maybeDeletePhoto(userId: string, publicId: string) {
    const settings = await this.prisma.userSettings.findUnique({ where: { userId } });
    if (settings?.retainFoodPhotos) return;
    await this.media.destroy(publicId);
  }

  private serialize(
    run: {
      id: string;
      status: string;
      model: string;
      promptVersion: string;
      schemaVersion: string;
      cloudinaryPublicId: string;
      latencyMs: number | null;
      overallConfidence: { toNumber?: () => number } | number | null;
      normalizedOutput: unknown;
      failureCode: string | null;
      createdAt: Date;
      confirmedAt: Date | null;
    },
    quota?: { used: number; quota: number; remaining: number },
  ) {
    const conf =
      run.overallConfidence == null
        ? null
        : typeof run.overallConfidence === 'number'
          ? run.overallConfidence
          : Number(run.overallConfidence);
    return {
      id: run.id,
      status: run.status,
      model: run.model,
      prompt_version: run.promptVersion,
      schema_version: run.schemaVersion,
      latency_ms: run.latencyMs,
      overall_confidence: conf,
      result: run.normalizedOutput,
      failure_code: run.failureCode,
      created_at: run.createdAt.toISOString(),
      confirmed_at: run.confirmedAt?.toISOString() ?? null,
      photo_policy: 'auto_delete_after_analysis',
      quota,
      disclaimer:
        'Estimasi AI dapat tidak akurat. Periksa dan koreksi sebelum menyimpan. Bukan nasihat medis.',
    };
  }
}
