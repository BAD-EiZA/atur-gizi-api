import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { localDateString, parseDateOnly } from '../../common/utils/date.util';
import { motivationalMessage } from '../../common/utils/motivation.util';

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
      take: 10,
      include: { items: true },
    });
    const activityLogs = await this.prisma.activityLog.findMany({
      where: { userId, logDate, deletedAt: null },
      orderBy: { startedAt: 'desc' },
      take: 10,
      include: { activityType: true },
    });

    const consumed = foodLogs.reduce((s, f) => s + f.totalCalories, 0);
    const burned = activityLogs.reduce((s, a) => s + a.caloriesBurned, 0);
    const duration = activityLogs.reduce((s, a) => s + a.durationMinutes, 0);
    const intakeTarget = target?.calorieTarget ?? 0;
    const net = consumed - burned;
    const remaining = intakeTarget - net;
    const progressPct = intakeTarget > 0 ? Math.round((net / intakeTarget) * 100) : 0;

    const message = motivationalMessage({
      foodLogCount: foodLogs.length,
      progressPct,
      hasActivity: activityLogs.length > 0,
    });

    return {
      date: logDateStr,
      timezone: tz,
      intake_target: intakeTarget,
      consumed_calories: consumed,
      burned_calories: burned,
      net_calories: net,
      remaining_calories: remaining,
      progress_pct: progressPct,
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
      recent_food: foodLogs.map((f) => ({
        id: f.id,
        title: f.title,
        meal_type: f.mealType,
        total_calories: f.totalCalories,
        consumed_at: f.consumedAt.toISOString(),
      })),
      recent_activity: activityLogs.map((a) => ({
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
