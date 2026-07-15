"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const prisma_service_1 = require("../../prisma/prisma.service");
const media_service_1 = require("../media/media.service");
const nutrition_service_1 = require("../nutrition/nutrition.service");
const gemini_client_1 = require("./gemini.client");
const app_exception_1 = require("../../common/errors/app.exception");
const date_util_1 = require("../../common/utils/date.util");
const nutrition_util_1 = require("../../common/utils/nutrition.util");
let AiService = class AiService {
    prisma;
    media;
    nutrition;
    gemini;
    config;
    constructor(prisma, media, nutrition, gemini, config) {
        this.prisma = prisma;
        this.media = media;
        this.nutrition = nutrition;
        this.gemini = gemini;
        this.config = config;
    }
    async consumeQuota(userId) {
        const settings = await this.prisma.userSettings.findUnique({ where: { userId } });
        const tz = settings?.timezone ?? 'Asia/Jakarta';
        const usageDate = (0, date_util_1.parseDateOnly)((0, date_util_1.localDateString)(new Date(), tz));
        const quota = this.config.get('gemini.dailyQuota') ?? 10;
        const row = await this.prisma.aiUsageDaily.upsert({
            where: { userId_usageDate: { userId, usageDate } },
            create: { userId, usageDate, count: 0 },
            update: {},
        });
        if (row.count >= quota) {
            throw new app_exception_1.AppException('AI_QUOTA_EXCEEDED', `Kuota AI harian (${quota}) sudah habis. Coba lagi besok atau catat manual.`, common_1.HttpStatus.TOO_MANY_REQUESTS, [{ reason: 'daily_quota', field: 'quota' }]);
        }
        await this.prisma.aiUsageDaily.update({
            where: { id: row.id },
            data: { count: { increment: 1 } },
        });
        return { used: row.count + 1, quota, remaining: quota - row.count - 1 };
    }
    normalize(raw) {
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
                confidence_label: (0, nutrition_util_1.confidenceLabel)(conf),
                assumptions: i.assumptions ?? [],
            };
        });
        if (items.length === 0) {
            throw new app_exception_1.AppException('AI_NO_FOOD_DETECTED', 'Tidak ada makanan terdeteksi. Coba foto lain atau input manual.', common_1.HttpStatus.UNPROCESSABLE_ENTITY);
        }
        const recalcTotal = items.reduce((s, i) => s + i.calories, 0);
        const overall = Math.min(1, Math.max(0, Number(raw.overall_confidence) || items.reduce((s, i) => s + i.confidence, 0) / items.length));
        return {
            items,
            total_estimated_calories: recalcTotal,
            overall_confidence: overall,
            overall_confidence_label: (0, nutrition_util_1.confidenceLabel)(overall),
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
    async start(userId, dto) {
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
        }
        catch (e) {
            const code = e instanceof app_exception_1.AppException
                ? (e.getResponse().error?.code ?? 'AI_FAILED')
                : 'AI_PROVIDER_ERROR';
            const updated = await this.prisma.aiAnalysisRun.update({
                where: { id: run.id },
                data: {
                    status: 'failed',
                    latencyMs: Date.now() - started,
                    failureCode: code,
                },
            });
            await this.maybeDeletePhoto(userId, dto.cloudinaryPublicId);
            if (e instanceof app_exception_1.AppException)
                throw e;
            throw new app_exception_1.AppException('AI_PROVIDER_ERROR', 'Analisis AI gagal. Coba lagi atau catat manual.', common_1.HttpStatus.BAD_GATEWAY);
        }
    }
    async get(userId, id) {
        const run = await this.prisma.aiAnalysisRun.findFirst({ where: { id, userId } });
        if (!run) {
            throw new app_exception_1.AppException('AI_ANALYSIS_NOT_FOUND', 'Analisis tidak ditemukan.', common_1.HttpStatus.NOT_FOUND);
        }
        return this.serialize(run);
    }
    async retry(userId, id) {
        const run = await this.prisma.aiAnalysisRun.findFirst({ where: { id, userId } });
        if (!run) {
            throw new app_exception_1.AppException('AI_ANALYSIS_NOT_FOUND', 'Analisis tidak ditemukan.', common_1.HttpStatus.NOT_FOUND);
        }
        if (run.status === 'confirmed') {
            throw new app_exception_1.AppException('AI_ALREADY_CONFIRMED', 'Analisis sudah dikonfirmasi.', common_1.HttpStatus.CONFLICT);
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
        }
        catch (e) {
            await this.prisma.aiAnalysisRun.update({
                where: { id },
                data: {
                    status: 'failed',
                    latencyMs: Date.now() - started,
                    failureCode: 'AI_PROVIDER_ERROR',
                },
            });
            throw new app_exception_1.AppException('AI_PROVIDER_ERROR', 'Retry analisis gagal. Lanjut input manual.', common_1.HttpStatus.BAD_GATEWAY);
        }
    }
    async confirm(userId, id, dto) {
        const run = await this.prisma.aiAnalysisRun.findFirst({ where: { id, userId } });
        if (!run) {
            throw new app_exception_1.AppException('AI_ANALYSIS_NOT_FOUND', 'Analisis tidak ditemukan.', common_1.HttpStatus.NOT_FOUND);
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
            throw new app_exception_1.AppException('AI_NOT_READY', 'Analisis belum siap dikonfirmasi.', common_1.HttpStatus.CONFLICT);
        }
        const settings = await this.prisma.userSettings.findUnique({ where: { userId } });
        const retain = settings?.retainFoodPhotos ?? false;
        const foodLog = await this.nutrition.create(userId, {
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
        }, 'ai_confirmed', {
            aiAnalysisId: id,
            cloudinaryPublicId: retain ? run.cloudinaryPublicId : null,
            mediaDeliveryType: retain ? run.mediaDeliveryType : null,
        });
        await this.prisma.aiAnalysisRun.update({
            where: { id },
            data: { status: 'confirmed', confirmedAt: new Date() },
        });
        if (!retain) {
            await this.media.destroy(run.cloudinaryPublicId);
        }
        return { analysis_id: id, food_log: foodLog };
    }
    async cancel(userId, id) {
        const run = await this.prisma.aiAnalysisRun.findFirst({ where: { id, userId } });
        if (!run) {
            throw new app_exception_1.AppException('AI_ANALYSIS_NOT_FOUND', 'Analisis tidak ditemukan.', common_1.HttpStatus.NOT_FOUND);
        }
        if (run.status === 'confirmed') {
            throw new app_exception_1.AppException('AI_ALREADY_CONFIRMED', 'Tidak dapat membatalkan analisis terkonfirmasi.', common_1.HttpStatus.CONFLICT);
        }
        await this.prisma.aiAnalysisRun.update({
            where: { id },
            data: { status: 'cancelled' },
        });
        await this.maybeDeletePhoto(userId, run.cloudinaryPublicId);
        return { ok: true };
    }
    async maybeDeletePhoto(userId, publicId) {
        const settings = await this.prisma.userSettings.findUnique({ where: { userId } });
        if (settings?.retainFoodPhotos)
            return;
        await this.media.destroy(publicId);
    }
    serialize(run, quota) {
        const conf = run.overallConfidence == null
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
            disclaimer: 'Estimasi AI dapat tidak akurat. Periksa dan koreksi sebelum menyimpan. Bukan nasihat medis.',
        };
    }
};
exports.AiService = AiService;
exports.AiService = AiService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        media_service_1.MediaService,
        nutrition_service_1.NutritionService,
        gemini_client_1.GeminiClient,
        config_1.ConfigService])
], AiService);
//# sourceMappingURL=ai.service.js.map