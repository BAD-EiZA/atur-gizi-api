import { HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/errors/app.exception';
import { localDateString, parseDateOnly } from '../../common/utils/date.util';
import { MealType } from '@prisma/client';

@Injectable()
export class FeaturesService {
  constructor(private readonly prisma: PrismaService) {}

  // --- Weekly summary / insights ---
  async weeklySummary(userId: string, weekStart?: string) {
    const settings = await this.prisma.userSettings.findUnique({ where: { userId } });
    const tz = settings?.timezone ?? 'Asia/Jakarta';
    const startStr = weekStart ?? this.weekStartOf(localDateString(new Date(), tz));
    const start = parseDateOnly(startStr);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 6);

    const foods = await this.prisma.foodLog.findMany({
      where: { userId, deletedAt: null, logDate: { gte: start, lte: end } },
    });
    const activities = await this.prisma.activityLog.findMany({
      where: { userId, deletedAt: null, logDate: { gte: start, lte: end } },
    });
    const targets = await this.prisma.dailyTarget.findMany({
      where: { userId },
      orderBy: { effectiveFrom: 'desc' },
    });

    const days = new Map<string, { consumed: number; burned: number; target: number }>();
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setUTCDate(d.getUTCDate() + i);
      const key = d.toISOString().slice(0, 10);
      const target =
        targets.find((t) => t.effectiveFrom <= d && (!t.effectiveTo || t.effectiveTo >= d))
          ?.calorieTarget ?? 0;
      days.set(key, { consumed: 0, burned: 0, target });
    }
    for (const f of foods) {
      const k = f.logDate.toISOString().slice(0, 10);
      const row = days.get(k);
      if (row) row.consumed += f.totalCalories;
    }
    for (const a of activities) {
      const k = a.logDate.toISOString().slice(0, 10);
      const row = days.get(k);
      if (row) row.burned += a.caloriesBurned;
    }

    const daily = [...days.entries()].map(([date, v]) => ({
      date,
      consumed_calories: v.consumed,
      burned_calories: v.burned,
      target: v.target,
      net: v.consumed - v.burned,
      active: v.consumed > 0 || v.burned > 0,
    }));
    const activeDays = daily.filter((d) => d.active).length;
    const avgConsumed =
      activeDays > 0
        ? Math.round(daily.reduce((s, d) => s + d.consumed_calories, 0) / Math.max(activeDays, 1))
        : 0;
    const totalActivity = daily.reduce((s, d) => s + d.burned_calories, 0);
    const protein = foods.reduce((s, f) => s + Number(f.proteinG ?? 0), 0);
    const carbs = foods.reduce((s, f) => s + Number(f.carbsG ?? 0), 0);
    const fat = foods.reduce((s, f) => s + Number(f.fatG ?? 0), 0);

    const summary = {
      week_start: startStr,
      week_end: end.toISOString().slice(0, 10),
      active_days: activeDays,
      avg_consumed_calories: avgConsumed,
      total_activity_calories: totalActivity,
      macros: {
        protein_g: Math.round(protein),
        carbs_g: Math.round(carbs),
        fat_g: Math.round(fat),
      },
      daily,
      message:
        activeDays === 0
          ? 'Belum ada catatan minggu ini. Mulai kapan saja — tanpa tekanan.'
          : `Anda mencatat ${activeDays} hari aktif. Rata-rata konsumsi ${avgConsumed} kkal.`,
    };

    await this.prisma.weeklyInsight.upsert({
      where: { userId_weekStart: { userId, weekStart: start } },
      create: { userId, weekStart: start, summary },
      update: { summary },
    });

    return summary;
  }

  private weekStartOf(dateStr: string) {
    const d = parseDateOnly(dateStr);
    const day = d.getUTCDay(); // 0 Sun
    const diff = (day + 6) % 7; // Monday start
    d.setUTCDate(d.getUTCDate() - diff);
    return d.toISOString().slice(0, 10);
  }

  // --- Favorites ---
  listFavoriteFoods(userId: string) {
    return this.prisma.favoriteFood.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    }).then((rows) => ({
      data: rows.map((r) => ({
        id: r.id,
        name: r.name,
        portion_amount: Number(r.portionAmount),
        portion_unit: r.portionUnit,
        calories: r.calories,
        protein_g: r.proteinG != null ? Number(r.proteinG) : null,
        carbs_g: r.carbsG != null ? Number(r.carbsG) : null,
        fat_g: r.fatG != null ? Number(r.fatG) : null,
      })),
    }));
  }

  async createFavoriteFood(
    userId: string,
    dto: {
      name: string;
      portionAmount: number;
      portionUnit: string;
      calories: number;
      proteinG?: number;
      carbsG?: number;
      fatG?: number;
    },
  ) {
    const r = await this.prisma.favoriteFood.create({
      data: {
        userId,
        name: dto.name,
        portionAmount: dto.portionAmount,
        portionUnit: dto.portionUnit,
        calories: dto.calories,
        proteinG: dto.proteinG,
        carbsG: dto.carbsG,
        fatG: dto.fatG,
      },
    });
    return { id: r.id, name: r.name, calories: r.calories };
  }

  async deleteFavoriteFood(userId: string, id: string) {
    const row = await this.prisma.favoriteFood.findFirst({ where: { id, userId } });
    if (!row) throw new AppException('NOT_FOUND', 'Favorit tidak ditemukan.', HttpStatus.NOT_FOUND);
    await this.prisma.favoriteFood.delete({ where: { id } });
    return { ok: true };
  }

  listFavoriteActivities(userId: string) {
    return this.prisma.favoriteActivity.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    }).then((rows) => ({
      data: rows.map((r) => ({
        id: r.id,
        activity_type_id: r.activityTypeId,
        custom_name: r.customName,
        default_minutes: r.defaultMinutes,
      })),
    }));
  }

  async createFavoriteActivity(
    userId: string,
    dto: { activityTypeId?: string; customName?: string; defaultMinutes?: number },
  ) {
    const r = await this.prisma.favoriteActivity.create({
      data: {
        userId,
        activityTypeId: dto.activityTypeId,
        customName: dto.customName,
        defaultMinutes: dto.defaultMinutes ?? 30,
      },
    });
    return { id: r.id };
  }

  async deleteFavoriteActivity(userId: string, id: string) {
    const row = await this.prisma.favoriteActivity.findFirst({ where: { id, userId } });
    if (!row) throw new AppException('NOT_FOUND', 'Favorit tidak ditemukan.', HttpStatus.NOT_FOUND);
    await this.prisma.favoriteActivity.delete({ where: { id } });
    return { ok: true };
  }

  // --- Meal plans ---
  listMealPlans(userId: string, from?: string, to?: string) {
    return this.prisma.mealPlan.findMany({
      where: {
        userId,
        ...(from || to
          ? {
              planDate: {
                ...(from ? { gte: parseDateOnly(from) } : {}),
                ...(to ? { lte: parseDateOnly(to) } : {}),
              },
            }
          : {}),
      },
      orderBy: { planDate: 'desc' },
    }).then((rows) => ({
      data: rows.map((r) => ({
        id: r.id,
        title: r.title,
        plan_date: r.planDate.toISOString().slice(0, 10),
        meal_type: r.mealType,
        items: r.items,
        total_calories: r.totalCalories,
        notes: r.notes,
      })),
    }));
  }

  async createMealPlan(
    userId: string,
    dto: {
      title: string;
      planDate: string;
      mealType: MealType;
      items: unknown[];
      totalCalories: number;
      notes?: string;
    },
  ) {
    const r = await this.prisma.mealPlan.create({
      data: {
        userId,
        title: dto.title,
        planDate: parseDateOnly(dto.planDate),
        mealType: dto.mealType,
        items: dto.items as object,
        totalCalories: dto.totalCalories,
        notes: dto.notes,
      },
    });
    return { id: r.id, title: r.title };
  }

  async deleteMealPlan(userId: string, id: string) {
    const row = await this.prisma.mealPlan.findFirst({ where: { id, userId } });
    if (!row) throw new AppException('NOT_FOUND', 'Meal plan tidak ditemukan.', HttpStatus.NOT_FOUND);
    await this.prisma.mealPlan.delete({ where: { id } });
    return { ok: true };
  }

  // --- Barcode ---
  async lookupBarcode(userId: string, barcode: string) {
    let product = await this.prisma.barcodeProduct.findUnique({ where: { barcode } });
    if (!product) {
      // seed stub catalog for common demo barcodes
      const stubs: Record<string, { name: string; calories: number; brand?: string }> = {
        '8991002101151': { name: 'Susu UHT full cream 200ml', calories: 130, brand: 'Demo' },
        '8996001301135': { name: 'Biskuit gandum', calories: 90, brand: 'Demo' },
        '8999999000001': { name: 'Air mineral 600ml', calories: 0, brand: 'Demo' },
      };
      const stub = stubs[barcode];
      if (stub) {
        product = await this.prisma.barcodeProduct.create({
          data: {
            barcode,
            name: stub.name,
            brand: stub.brand,
            calories: stub.calories,
            source: 'catalog_stub',
          },
        });
      }
    }
    if (!product) {
      throw new AppException(
        'BARCODE_NOT_FOUND',
        'Produk tidak ditemukan. Tambahkan manual atau daftarkan barcode.',
        HttpStatus.NOT_FOUND,
      );
    }
    await this.prisma.barcodeScan.create({
      data: { userId, productId: product.id },
    });
    return {
      id: product.id,
      barcode: product.barcode,
      name: product.name,
      brand: product.brand,
      calories: product.calories,
      protein_g: product.proteinG != null ? Number(product.proteinG) : null,
      carbs_g: product.carbsG != null ? Number(product.carbsG) : null,
      fat_g: product.fatG != null ? Number(product.fatG) : null,
      serving_size: product.servingSize,
    };
  }

  async registerBarcode(
    userId: string,
    dto: {
      barcode: string;
      name: string;
      brand?: string;
      calories: number;
      proteinG?: number;
      carbsG?: number;
      fatG?: number;
      servingSize?: string;
    },
  ) {
    const product = await this.prisma.barcodeProduct.upsert({
      where: { barcode: dto.barcode },
      create: {
        barcode: dto.barcode,
        name: dto.name,
        brand: dto.brand,
        calories: dto.calories,
        proteinG: dto.proteinG,
        carbsG: dto.carbsG,
        fatG: dto.fatG,
        servingSize: dto.servingSize,
        source: 'user',
      },
      update: {
        name: dto.name,
        brand: dto.brand,
        calories: dto.calories,
        proteinG: dto.proteinG,
        carbsG: dto.carbsG,
        fatG: dto.fatG,
        servingSize: dto.servingSize,
      },
    });
    await this.prisma.barcodeScan.create({ data: { userId, productId: product.id } });
    return { id: product.id, barcode: product.barcode, name: product.name };
  }

  // --- Wearables (stub connect) ---
  listWearables(userId: string) {
    return this.prisma.wearableLink.findMany({ where: { userId } }).then((rows) => ({
      data: rows.map((r) => ({
        id: r.id,
        provider: r.provider,
        status: r.status,
        last_sync_at: r.lastSyncAt?.toISOString() ?? null,
      })),
      available: ['apple_health', 'google_health_connect', 'garmin', 'fitbit'],
    }));
  }

  async connectWearable(userId: string, provider: string) {
    const allowed = ['apple_health', 'google_health_connect', 'garmin', 'fitbit'];
    if (!allowed.includes(provider)) {
      throw new AppException('INVALID_PROVIDER', 'Provider wearable tidak didukung.', HttpStatus.BAD_REQUEST);
    }
    const row = await this.prisma.wearableLink.upsert({
      where: { userId_provider: { userId, provider } },
      create: {
        userId,
        provider,
        status: 'connected',
        lastSyncAt: new Date(),
        externalId: `stub_${userId.slice(0, 8)}`,
      },
      update: { status: 'connected', lastSyncAt: new Date() },
    });
    return { id: row.id, provider: row.provider, status: row.status };
  }

  async syncWearable(userId: string, provider: string) {
    const row = await this.prisma.wearableLink.findUnique({
      where: { userId_provider: { userId, provider } },
    });
    if (!row) throw new AppException('NOT_CONNECTED', 'Wearable belum terhubung.', HttpStatus.NOT_FOUND);
    await this.prisma.wearableLink.update({
      where: { id: row.id },
      data: { lastSyncAt: new Date() },
    });
    return {
      provider,
      synced_at: new Date().toISOString(),
      imported_activities: 0,
      note: 'Sinkronisasi stub — integrasi native menyusul.',
    };
  }

  async disconnectWearable(userId: string, provider: string) {
    await this.prisma.wearableLink.deleteMany({ where: { userId, provider } });
    return { ok: true };
  }

  // --- Social feed ---
  async listFeed(userId: string) {
    const posts = await this.prisma.socialPost.findMany({
      where: { deletedAt: null, OR: [{ userId }, { visibility: 'public' }] },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { user: { select: { displayName: true, id: true } } },
    });
    return {
      data: posts.map((p) => ({
        id: p.id,
        body: p.body,
        visibility: p.visibility,
        author: p.user.displayName || 'Pengguna',
        is_mine: p.userId === userId,
        created_at: p.createdAt.toISOString(),
      })),
    };
  }

  async createPost(userId: string, body: string, visibility = 'friends') {
    if (!body?.trim() || body.length > 500) {
      throw new AppException('INVALID_POST', 'Post 1–500 karakter.', HttpStatus.BAD_REQUEST);
    }
    const p = await this.prisma.socialPost.create({
      data: { userId, body: body.trim(), visibility },
    });
    return { id: p.id, body: p.body, created_at: p.createdAt.toISOString() };
  }

  async deletePost(userId: string, id: string) {
    const p = await this.prisma.socialPost.findFirst({ where: { id, userId, deletedAt: null } });
    if (!p) throw new AppException('NOT_FOUND', 'Post tidak ditemukan.', HttpStatus.NOT_FOUND);
    await this.prisma.socialPost.update({ where: { id }, data: { deletedAt: new Date() } });
    return { ok: true };
  }

  // --- Export ---
  async exportData(userId: string, format: 'json' | 'csv' = 'json') {
    const [profile, settings, foods, activities, targets] = await Promise.all([
      this.prisma.userProfile.findUnique({ where: { userId } }),
      this.prisma.userSettings.findUnique({ where: { userId } }),
      this.prisma.foodLog.findMany({
        where: { userId, deletedAt: null },
        include: { items: true },
        orderBy: { consumedAt: 'desc' },
        take: 5000,
      }),
      this.prisma.activityLog.findMany({
        where: { userId, deletedAt: null },
        orderBy: { startedAt: 'desc' },
        take: 5000,
      }),
      this.prisma.dailyTarget.findMany({ where: { userId }, orderBy: { effectiveFrom: 'desc' } }),
    ]);

    const payload = {
      exported_at: new Date().toISOString(),
      profile,
      settings,
      daily_targets: targets,
      food_logs: foods,
      activity_logs: activities,
    };

    const job = await this.prisma.exportJob.create({
      data: { userId, format, status: 'ready', payload: payload as object },
    });

    if (format === 'csv') {
      const foodCsv = [
        'id,log_date,meal_type,title,total_calories',
        ...foods.map(
          (f) =>
            `${f.id},${f.logDate.toISOString().slice(0, 10)},${f.mealType},"${(f.title || '').replace(/"/g, '""')}",${f.totalCalories}`,
        ),
      ].join('\n');
      const actCsv = [
        'id,log_date,duration_minutes,calories_burned',
        ...activities.map(
          (a) =>
            `${a.id},${a.logDate.toISOString().slice(0, 10)},${a.durationMinutes},${a.caloriesBurned}`,
        ),
      ].join('\n');
      return {
        job_id: job.id,
        format: 'csv',
        food_csv: foodCsv,
        activity_csv: actCsv,
      };
    }

    return { job_id: job.id, format: 'json', data: payload };
  }

  // --- Subscription / payment stub ---
  async getSubscription(userId: string) {
    let sub = await this.prisma.subscription.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    if (!sub) {
      sub = await this.prisma.subscription.create({
        data: { userId, plan: 'free', status: 'active' },
      });
    }
    return {
      plan: sub.plan,
      status: sub.status,
      provider: sub.provider,
      current_period_end: sub.currentPeriodEnd?.toISOString() ?? null,
      plans: [
        { id: 'free', name: 'Gratis', price_idr: 0, ai_quota: 10 },
        { id: 'plus', name: 'Plus', price_idr: 49000, ai_quota: 50 },
        { id: 'pro', name: 'Pro', price_idr: 99000, ai_quota: 200 },
      ],
    };
  }

  async checkout(userId: string, plan: string) {
    if (!['free', 'plus', 'pro'].includes(plan)) {
      throw new AppException('INVALID_PLAN', 'Paket tidak valid.', HttpStatus.BAD_REQUEST);
    }
    const end = new Date();
    end.setUTCMonth(end.getUTCMonth() + 1);
    const sub = await this.prisma.subscription.create({
      data: {
        userId,
        plan,
        status: plan === 'free' ? 'active' : 'pending_payment',
        provider: 'manual_stub',
        externalId: `chk_${Date.now()}`,
        currentPeriodEnd: end,
      },
    });
    return {
      subscription_id: sub.id,
      plan: sub.plan,
      status: sub.status,
      checkout_url: null,
      message:
        plan === 'free'
          ? 'Paket gratis aktif.'
          : 'Checkout stub — hubungkan payment gateway di iterasi berikutnya. Status pending_payment.',
    };
  }

  // --- Macro targets helper ---
  async macroTargets(userId: string) {
    const target = await this.prisma.dailyTarget.findFirst({
      where: { userId, effectiveTo: null },
      orderBy: { effectiveFrom: 'desc' },
    });
    const kcal = target?.calorieTarget ?? 2000;
    // classic split 30P / 40C / 30F
    return {
      calorie_target: kcal,
      protein_g: Math.round((kcal * 0.3) / 4),
      carbs_g: Math.round((kcal * 0.4) / 4),
      fat_g: Math.round((kcal * 0.3) / 9),
      split: { protein_pct: 30, carbs_pct: 40, fat_pct: 30 },
    };
  }
}
