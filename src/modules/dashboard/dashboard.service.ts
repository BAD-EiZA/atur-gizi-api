import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { localDateString, parseDateOnly } from '../../common/utils/date.util';
import { motivationalMessage } from '../../common/utils/motivation.util';
import { computeBudget, type CalorieBudgetMode } from '../../common/utils/nutrition.util';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async daily(userId: string, date?: string) {
    const settings = await this.prisma.userSettings.findUnique({ where: { userId } });
    const tz = settings?.timezone ?? 'Asia/Jakarta';
    const logDateStr = date ?? localDateString(new Date(), tz);
    const logDate = parseDateOnly(logDateStr);

    const target = await this.prisma.dailyTarget.findFirst({
      where: {
        userId,
        effectiveFrom: { lte: logDate },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: logDate } }],
      },
      orderBy: { effectiveFrom: 'desc' },
    });

    const foodLogs = await this.prisma.foodLog.findMany({
      where: { userId, logDate, deletedAt: null },
      orderBy: { consumedAt: 'desc' },
    });
    const activityLogs = await this.prisma.activityLog.findMany({
      where: { userId, logDate, deletedAt: null },
      orderBy: { startedAt: 'desc' },
      include: { activityType: true },
    });
    const recentFood = foodLogs.slice(0, 10);
    const recentActivity = activityLogs.slice(0, 10);

    const consumed = foodLogs.reduce((s, f) => s + f.totalCalories, 0);
    const proteinG = foodLogs.reduce((s, f) => s + (f.proteinG != null ? Number(f.proteinG) : 0), 0);
    const carbsG = foodLogs.reduce((s, f) => s + (f.carbsG != null ? Number(f.carbsG) : 0), 0);
    const fatG = foodLogs.reduce((s, f) => s + (f.fatG != null ? Number(f.fatG) : 0), 0);
    const burned = activityLogs.reduce((s, a) => s + a.caloriesBurned, 0);
    const duration = activityLogs.reduce((s, a) => s + a.durationMinutes, 0);
    const intakeTarget = target?.calorieTarget ?? 0;
    const budgetMode: CalorieBudgetMode =
      settings?.calorieBudgetMode === 'eat_back' ? 'eat_back' : 'intake_only';
    const budget = computeBudget({
      mode: budgetMode,
      intakeTarget,
      consumed,
      burned,
    });

    const message = motivationalMessage({
      foodLogCount: foodLogs.length,
      progressPct: budget.progress_pct,
      hasActivity: activityLogs.length > 0,
    });

    const proteinTarget =
      target?.proteinTargetG != null ? Number(target.proteinTargetG) : null;
    const carbsTarget = target?.carbsTargetG != null ? Number(target.carbsTargetG) : null;
    const fatTarget = target?.fatTargetG != null ? Number(target.fatTargetG) : null;

    return {
      date: logDateStr,
      timezone: tz,
      intake_target: intakeTarget,
      consumed_calories: consumed,
      consumed_protein_g: Math.round(proteinG * 10) / 10,
      consumed_carbs_g: Math.round(carbsG * 10) / 10,
      consumed_fat_g: Math.round(fatG * 10) / 10,
      protein_target_g: proteinTarget,
      carbs_target_g: carbsTarget,
      fat_target_g: fatTarget,
      burned_calories: burned,
      net_calories: budget.net_calories,
      remaining_calories: budget.remaining_calories,
      remaining_intake: budget.remaining_intake,
      remaining_net: budget.remaining_net,
      budget_mode: budget.budget_mode,
      progress_pct: budget.progress_pct,
      food_log_count: foodLogs.length,
      activity_duration_minutes: duration,
      motivational_message: message,
      target: target
        ? {
            calorie_target: target.calorieTarget,
            bmr_kcal: target.bmrKcal,
            tdee_kcal: target.tdeeKcal,
            goal: target.goal,
          }
        : null,
      recent_food: recentFood.map((f) => ({
        id: f.id,
        title: f.title,
        meal_type: f.mealType,
        total_calories: f.totalCalories,
        protein_g: f.proteinG != null ? Number(f.proteinG) : null,
        carbs_g: f.carbsG != null ? Number(f.carbsG) : null,
        fat_g: f.fatG != null ? Number(f.fatG) : null,
        consumed_at: f.consumedAt.toISOString(),
      })),
      recent_activity: recentActivity.map((a) => ({
        id: a.id,
        name: a.activityType?.name ?? a.customName ?? 'Aktivitas',
        duration_minutes: a.durationMinutes,
        calories_burned: a.caloriesBurned,
        started_at: a.startedAt?.toISOString() ?? null,
      })),
    };
  }

  async history(userId: string, from: string, to: string) {
    const fromDate = parseDateOnly(from);
    const toDate = parseDateOnly(to);
    const foods = await this.prisma.foodLog.findMany({
      where: { userId, deletedAt: null, logDate: { gte: fromDate, lte: toDate } },
      orderBy: [{ logDate: 'desc' }, { consumedAt: 'desc' }],
    });
    const activities = await this.prisma.activityLog.findMany({
      where: { userId, deletedAt: null, logDate: { gte: fromDate, lte: toDate } },
      orderBy: [{ logDate: 'desc' }, { startedAt: 'desc' }],
      include: { activityType: true },
    });

    type TimelineItem =
      | {
          kind: 'food';
          id: string;
          log_date: string;
          at: string;
          title: string;
          calories: number;
          meal_type: string;
          protein_g: number | null;
          carbs_g: number | null;
          fat_g: number | null;
        }
      | {
          kind: 'activity';
          id: string;
          log_date: string;
          at: string | null;
          title: string;
          calories: number;
          duration_minutes: number;
        };

    const timeline: TimelineItem[] = [
      ...foods.map(
        (f): TimelineItem => ({
          kind: 'food',
          id: f.id,
          log_date: f.logDate.toISOString().slice(0, 10),
          at: f.consumedAt.toISOString(),
          title: f.title,
          calories: f.totalCalories,
          meal_type: f.mealType,
          protein_g: f.proteinG != null ? Number(f.proteinG) : null,
          carbs_g: f.carbsG != null ? Number(f.carbsG) : null,
          fat_g: f.fatG != null ? Number(f.fatG) : null,
        }),
      ),
      ...activities.map(
        (a): TimelineItem => ({
          kind: 'activity',
          id: a.id,
          log_date: a.logDate.toISOString().slice(0, 10),
          at: a.startedAt?.toISOString() ?? null,
          title: a.activityType?.name ?? a.customName ?? 'Aktivitas',
          calories: a.caloriesBurned,
          duration_minutes: a.durationMinutes,
        }),
      ),
    ].sort((a, b) => {
      const ta = a.at ?? a.log_date;
      const tb = b.at ?? b.log_date;
      return tb.localeCompare(ta);
    });

    return { from, to, data: timeline };
  }
}
