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
exports.NutritionService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const app_exception_1 = require("../../common/errors/app.exception");
const date_util_1 = require("../../common/utils/date.util");
let NutritionService = class NutritionService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    sumItems(items) {
        const totalCalories = items.reduce((s, i) => s + i.calories, 0);
        const proteinG = items.reduce((s, i) => s + (i.proteinG ?? 0), 0);
        const carbsG = items.reduce((s, i) => s + (i.carbsG ?? 0), 0);
        const fatG = items.reduce((s, i) => s + (i.fatG ?? 0), 0);
        return { totalCalories, proteinG, carbsG, fatG };
    }
    async timezone(userId) {
        const s = await this.prisma.userSettings.findUnique({ where: { userId } });
        return s?.timezone ?? 'Asia/Jakarta';
    }
    async create(userId, dto, source = 'manual', extra) {
        const tz = await this.timezone(userId);
        const consumedAt = new Date(dto.consumedAt);
        const logDate = dto.logDate
            ? (0, date_util_1.parseDateOnly)(dto.logDate)
            : (0, date_util_1.parseDateOnly)((0, date_util_1.localDateString)(consumedAt, tz));
        const sums = this.sumItems(dto.items);
        const log = await this.prisma.foodLog.create({
            data: {
                userId,
                logDate,
                consumedAt,
                mealType: dto.mealType,
                title: dto.title,
                totalCalories: sums.totalCalories,
                proteinG: sums.proteinG,
                carbsG: sums.carbsG,
                fatG: sums.fatG,
                source,
                notes: dto.notes,
                aiAnalysisId: extra?.aiAnalysisId,
                cloudinaryPublicId: extra?.cloudinaryPublicId ?? null,
                mediaDeliveryType: extra?.mediaDeliveryType ?? null,
                items: {
                    create: dto.items.map((item, idx) => ({
                        name: item.name,
                        portionAmount: item.portionAmount,
                        portionUnit: item.portionUnit,
                        calories: item.calories,
                        proteinG: item.proteinG,
                        carbsG: item.carbsG,
                        fatG: item.fatG,
                        fiberG: item.fiberG,
                        aiConfidence: item.aiConfidence,
                        sortOrder: idx,
                    })),
                },
            },
            include: { items: { orderBy: { sortOrder: 'asc' } } },
        });
        return this.serialize(log);
    }
    async list(userId, query) {
        const limit = Math.min(query.limit ?? 20, 50);
        const where = {
            userId,
            deletedAt: null,
            ...(query.mealType ? { mealType: query.mealType } : {}),
            ...(query.from || query.to
                ? {
                    logDate: {
                        ...(query.from ? { gte: (0, date_util_1.parseDateOnly)(query.from) } : {}),
                        ...(query.to ? { lte: (0, date_util_1.parseDateOnly)(query.to) } : {}),
                    },
                }
                : {}),
        };
        const items = await this.prisma.foodLog.findMany({
            where,
            take: limit + 1,
            ...(query.cursor
                ? { cursor: { id: query.cursor }, skip: 1 }
                : {}),
            orderBy: [{ logDate: 'desc' }, { consumedAt: 'desc' }],
            include: { items: { orderBy: { sortOrder: 'asc' } } },
        });
        let nextCursor = null;
        if (items.length > limit) {
            const next = items.pop();
            nextCursor = next.id;
        }
        return { data: items.map((i) => this.serialize(i)), next_cursor: nextCursor };
    }
    async get(userId, id) {
        const log = await this.prisma.foodLog.findFirst({
            where: { id, userId, deletedAt: null },
            include: { items: { orderBy: { sortOrder: 'asc' } } },
        });
        if (!log) {
            throw new app_exception_1.AppException('FOOD_LOG_NOT_FOUND', 'Log makanan tidak ditemukan.', common_1.HttpStatus.NOT_FOUND);
        }
        return this.serialize(log);
    }
    async update(userId, id, dto) {
        const existing = await this.prisma.foodLog.findFirst({
            where: { id, userId, deletedAt: null },
        });
        if (!existing) {
            throw new app_exception_1.AppException('FOOD_LOG_NOT_FOUND', 'Log makanan tidak ditemukan.', common_1.HttpStatus.NOT_FOUND);
        }
        const tz = await this.timezone(userId);
        const consumedAt = dto.consumedAt ? new Date(dto.consumedAt) : existing.consumedAt;
        const logDate = (0, date_util_1.parseDateOnly)((0, date_util_1.localDateString)(consumedAt, tz));
        const log = await this.prisma.$transaction(async (tx) => {
            if (dto.items) {
                await tx.foodItem.deleteMany({ where: { foodLogId: id } });
                const sums = this.sumItems(dto.items);
                return tx.foodLog.update({
                    where: { id },
                    data: {
                        consumedAt,
                        logDate,
                        mealType: dto.mealType ?? existing.mealType,
                        title: dto.title ?? existing.title,
                        notes: dto.notes ?? existing.notes,
                        totalCalories: sums.totalCalories,
                        proteinG: sums.proteinG,
                        carbsG: sums.carbsG,
                        fatG: sums.fatG,
                        items: {
                            create: dto.items.map((item, idx) => ({
                                name: item.name,
                                portionAmount: item.portionAmount,
                                portionUnit: item.portionUnit,
                                calories: item.calories,
                                proteinG: item.proteinG,
                                carbsG: item.carbsG,
                                fatG: item.fatG,
                                fiberG: item.fiberG,
                                aiConfidence: item.aiConfidence,
                                sortOrder: idx,
                            })),
                        },
                    },
                    include: { items: { orderBy: { sortOrder: 'asc' } } },
                });
            }
            return tx.foodLog.update({
                where: { id },
                data: {
                    consumedAt,
                    logDate,
                    mealType: dto.mealType,
                    title: dto.title,
                    notes: dto.notes,
                },
                include: { items: { orderBy: { sortOrder: 'asc' } } },
            });
        });
        return this.serialize(log);
    }
    async remove(userId, id) {
        const existing = await this.prisma.foodLog.findFirst({
            where: { id, userId, deletedAt: null },
        });
        if (!existing) {
            throw new app_exception_1.AppException('FOOD_LOG_NOT_FOUND', 'Log makanan tidak ditemukan.', common_1.HttpStatus.NOT_FOUND);
        }
        await this.prisma.foodLog.update({
            where: { id },
            data: { deletedAt: new Date() },
        });
        return { ok: true };
    }
    serialize(log) {
        const d = (v) => (v == null ? null : Number(v));
        return {
            id: log.id,
            log_date: log.logDate.toISOString().slice(0, 10),
            consumed_at: log.consumedAt.toISOString(),
            meal_type: log.mealType,
            title: log.title,
            total_calories: log.totalCalories,
            protein_g: d(log.proteinG),
            carbs_g: d(log.carbsG),
            fat_g: d(log.fatG),
            source: log.source,
            notes: log.notes,
            items: log.items.map((i) => ({
                id: i.id,
                name: i.name,
                portion_amount: Number(i.portionAmount),
                portion_unit: i.portionUnit,
                calories: i.calories,
                protein_g: d(i.proteinG),
                carbs_g: d(i.carbsG),
                fat_g: d(i.fatG),
                fiber_g: d(i.fiberG),
                ai_confidence: d(i.aiConfidence),
                sort_order: i.sortOrder,
            })),
        };
    }
};
exports.NutritionService = NutritionService;
exports.NutritionService = NutritionService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], NutritionService);
//# sourceMappingURL=nutrition.service.js.map