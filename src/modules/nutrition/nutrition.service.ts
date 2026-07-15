import { HttpStatus, Injectable } from '@nestjs/common';
import { FoodLogSource, MealType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/errors/app.exception';
import { CreateFoodLogDto, FoodItemDto, UpdateFoodLogDto } from './dto/food-log.dto';
import { localDateString, parseDateOnly } from '../../common/utils/date.util';

@Injectable()
export class NutritionService {
  constructor(private readonly prisma: PrismaService) {}

  private sumItems(items: FoodItemDto[]) {
    const totalCalories = items.reduce((s, i) => s + i.calories, 0);
    const proteinG = items.reduce((s, i) => s + (i.proteinG ?? 0), 0);
    const carbsG = items.reduce((s, i) => s + (i.carbsG ?? 0), 0);
    const fatG = items.reduce((s, i) => s + (i.fatG ?? 0), 0);
    return { totalCalories, proteinG, carbsG, fatG };
  }

  private async timezone(userId: string) {
    const s = await this.prisma.userSettings.findUnique({ where: { userId } });
    return s?.timezone ?? 'Asia/Jakarta';
  }

  async create(userId: string, dto: CreateFoodLogDto, source: FoodLogSource = 'manual', extra?: {
    aiAnalysisId?: string;
    cloudinaryPublicId?: string | null;
    mediaDeliveryType?: string | null;
  }) {
    const tz = await this.timezone(userId);
    const consumedAt = new Date(dto.consumedAt);
    const logDate = dto.logDate
      ? parseDateOnly(dto.logDate)
      : parseDateOnly(localDateString(consumedAt, tz));
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

  async list(
    userId: string,
    query: { from?: string; to?: string; mealType?: MealType; cursor?: string; limit?: number },
  ) {
    const limit = Math.min(query.limit ?? 20, 50);
    const where: Prisma.FoodLogWhereInput = {
      userId,
      deletedAt: null,
      ...(query.mealType ? { mealType: query.mealType } : {}),
      ...(query.from || query.to
        ? {
            logDate: {
              ...(query.from ? { gte: parseDateOnly(query.from) } : {}),
              ...(query.to ? { lte: parseDateOnly(query.to) } : {}),
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

    let nextCursor: string | null = null;
    if (items.length > limit) {
      const next = items.pop()!;
      nextCursor = next.id;
    }
    return { data: items.map((i) => this.serialize(i)), next_cursor: nextCursor };
  }

  async get(userId: string, id: string) {
    const log = await this.prisma.foodLog.findFirst({
      where: { id, userId, deletedAt: null },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!log) {
      throw new AppException('FOOD_LOG_NOT_FOUND', 'Log makanan tidak ditemukan.', HttpStatus.NOT_FOUND);
    }
    return this.serialize(log);
  }

  async update(userId: string, id: string, dto: UpdateFoodLogDto) {
    const existing = await this.prisma.foodLog.findFirst({
      where: { id, userId, deletedAt: null },
    });
    if (!existing) {
      throw new AppException('FOOD_LOG_NOT_FOUND', 'Log makanan tidak ditemukan.', HttpStatus.NOT_FOUND);
    }

    const tz = await this.timezone(userId);
    const consumedAt = dto.consumedAt ? new Date(dto.consumedAt) : existing.consumedAt;
    const logDate = parseDateOnly(localDateString(consumedAt, tz));

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

  async remove(userId: string, id: string) {
    const existing = await this.prisma.foodLog.findFirst({
      where: { id, userId, deletedAt: null },
    });
    if (!existing) {
      throw new AppException('FOOD_LOG_NOT_FOUND', 'Log makanan tidak ditemukan.', HttpStatus.NOT_FOUND);
    }
    await this.prisma.foodLog.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return { ok: true };
  }

  private serialize(log: {
    id: string;
    userId: string;
    logDate: Date;
    consumedAt: Date;
    mealType: MealType;
    title: string;
    totalCalories: number;
    proteinG: Prisma.Decimal | null;
    carbsG: Prisma.Decimal | null;
    fatG: Prisma.Decimal | null;
    source: FoodLogSource;
    notes: string | null;
    items: Array<{
      id: string;
      name: string;
      portionAmount: Prisma.Decimal;
      portionUnit: string;
      calories: number;
      proteinG: Prisma.Decimal | null;
      carbsG: Prisma.Decimal | null;
      fatG: Prisma.Decimal | null;
      fiberG: Prisma.Decimal | null;
      aiConfidence: Prisma.Decimal | null;
      sortOrder: number;
    }>;
  }) {
    const d = (v: Prisma.Decimal | null) => (v == null ? null : Number(v));
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
}
