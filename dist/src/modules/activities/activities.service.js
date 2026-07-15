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
exports.ActivitiesService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../prisma/prisma.service");
const app_exception_1 = require("../../common/errors/app.exception");
const nutrition_util_1 = require("../../common/utils/nutrition.util");
const date_util_1 = require("../../common/utils/date.util");
let ActivitiesService = class ActivitiesService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
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
    async weightKg(userId, override) {
        if (override != null)
            return override;
        const p = await this.prisma.userProfile.findUnique({ where: { userId } });
        if (!p?.currentWeightKg) {
            throw new app_exception_1.AppException('WEIGHT_REQUIRED', 'Berat badan profil diperlukan untuk estimasi aktivitas.', common_1.HttpStatus.BAD_REQUEST);
        }
        return Number(p.currentWeightKg);
    }
    async estimate(userId, dto) {
        let met = dto.metValue;
        if (!met && dto.activityTypeId) {
            const t = await this.prisma.activityType.findFirst({
                where: { id: dto.activityTypeId, active: true },
            });
            if (!t) {
                throw new app_exception_1.AppException('ACTIVITY_TYPE_NOT_FOUND', 'Jenis aktivitas tidak ditemukan.', common_1.HttpStatus.NOT_FOUND);
            }
            met = Number(t.defaultMet);
        }
        if (!met) {
            throw new app_exception_1.AppException('MET_REQUIRED', 'Nilai MET diperlukan.', common_1.HttpStatus.BAD_REQUEST);
        }
        const weight = await this.weightKg(userId, dto.weightKg);
        const calories = (0, nutrition_util_1.calcActivityCalories)(met, weight, dto.durationMinutes);
        return {
            met_value: met,
            weight_kg: weight,
            duration_minutes: dto.durationMinutes,
            calculated_calories: calories,
            formula_version: nutrition_util_1.ACTIVITY_FORMULA_VERSION,
        };
    }
    async create(userId, dto) {
        let met = dto.metValue;
        let typeId = dto.activityTypeId ?? null;
        if (typeId) {
            const t = await this.prisma.activityType.findFirst({
                where: { id: typeId, active: true },
            });
            if (!t) {
                throw new app_exception_1.AppException('ACTIVITY_TYPE_NOT_FOUND', 'Jenis aktivitas tidak ditemukan.', common_1.HttpStatus.NOT_FOUND);
            }
            met = met ?? Number(t.defaultMet);
        }
        if (!met) {
            throw new app_exception_1.AppException('MET_REQUIRED', 'Nilai MET diperlukan.', common_1.HttpStatus.BAD_REQUEST);
        }
        if (!typeId && !dto.customName) {
            throw new app_exception_1.AppException('ACTIVITY_NAME_REQUIRED', 'activityTypeId atau customName wajib.', common_1.HttpStatus.BAD_REQUEST);
        }
        const weight = await this.weightKg(userId);
        const calculated = (0, nutrition_util_1.calcActivityCalories)(met, weight, dto.durationMinutes);
        const burned = dto.caloriesBurned ?? calculated;
        const settings = await this.prisma.userSettings.findUnique({ where: { userId } });
        const tz = settings?.timezone ?? 'Asia/Jakarta';
        const startedAt = dto.startedAt ? new Date(dto.startedAt) : new Date();
        const logDate = dto.logDate
            ? (0, date_util_1.parseDateOnly)(dto.logDate)
            : (0, date_util_1.parseDateOnly)((0, date_util_1.localDateString)(startedAt, tz));
        const log = await this.prisma.activityLog.create({
            data: {
                userId,
                activityTypeId: typeId,
                customName: dto.customName,
                logDate,
                startedAt,
                durationMinutes: dto.durationMinutes,
                intensity: dto.intensity ?? client_1.Intensity.moderate,
                metValue: met,
                weightSnapshotKg: weight,
                calculatedCalories: calculated,
                caloriesBurned: burned,
                formulaVersion: nutrition_util_1.ACTIVITY_FORMULA_VERSION,
                notes: dto.notes,
            },
            include: { activityType: true },
        });
        return this.serialize(log);
    }
    async list(userId, query) {
        const limit = Math.min(query.limit ?? 20, 50);
        const where = {
            userId,
            deletedAt: null,
            ...(query.from || query.to
                ? {
                    logDate: {
                        ...(query.from ? { gte: (0, date_util_1.parseDateOnly)(query.from) } : {}),
                        ...(query.to ? { lte: (0, date_util_1.parseDateOnly)(query.to) } : {}),
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
        let nextCursor = null;
        if (items.length > limit) {
            const next = items.pop();
            nextCursor = next.id;
        }
        return { data: items.map((i) => this.serialize(i)), next_cursor: nextCursor };
    }
    async get(userId, id) {
        const log = await this.prisma.activityLog.findFirst({
            where: { id, userId, deletedAt: null },
            include: { activityType: true },
        });
        if (!log) {
            throw new app_exception_1.AppException('ACTIVITY_LOG_NOT_FOUND', 'Log aktivitas tidak ditemukan.', common_1.HttpStatus.NOT_FOUND);
        }
        return this.serialize(log);
    }
    async update(userId, id, dto) {
        const existing = await this.prisma.activityLog.findFirst({
            where: { id, userId, deletedAt: null },
        });
        if (!existing) {
            throw new app_exception_1.AppException('ACTIVITY_LOG_NOT_FOUND', 'Log aktivitas tidak ditemukan.', common_1.HttpStatus.NOT_FOUND);
        }
        const duration = dto.durationMinutes ?? existing.durationMinutes;
        const met = Number(existing.metValue);
        const weight = Number(existing.weightSnapshotKg);
        const calculated = (0, nutrition_util_1.calcActivityCalories)(met, weight, duration);
        const burned = dto.caloriesBurned ?? calculated;
        const settings = await this.prisma.userSettings.findUnique({ where: { userId } });
        const tz = settings?.timezone ?? 'Asia/Jakarta';
        const startedAt = dto.startedAt ? new Date(dto.startedAt) : existing.startedAt;
        const logDate = startedAt
            ? (0, date_util_1.parseDateOnly)((0, date_util_1.localDateString)(startedAt, tz))
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
    async remove(userId, id) {
        const existing = await this.prisma.activityLog.findFirst({
            where: { id, userId, deletedAt: null },
        });
        if (!existing) {
            throw new app_exception_1.AppException('ACTIVITY_LOG_NOT_FOUND', 'Log aktivitas tidak ditemukan.', common_1.HttpStatus.NOT_FOUND);
        }
        await this.prisma.activityLog.update({
            where: { id },
            data: { deletedAt: new Date() },
        });
        return { ok: true };
    }
    serialize(log) {
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
};
exports.ActivitiesService = ActivitiesService;
exports.ActivitiesService = ActivitiesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ActivitiesService);
//# sourceMappingURL=activities.service.js.map