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
exports.DashboardService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const date_util_1 = require("../../common/utils/date.util");
const motivation_util_1 = require("../../common/utils/motivation.util");
let DashboardService = class DashboardService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async daily(userId, date) {
        const settings = await this.prisma.userSettings.findUnique({ where: { userId } });
        const tz = settings?.timezone ?? 'Asia/Jakarta';
        const logDateStr = date ?? (0, date_util_1.localDateString)(new Date(), tz);
        const logDate = (0, date_util_1.parseDateOnly)(logDateStr);
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
        const message = (0, motivation_util_1.motivationalMessage)({
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
    async history(userId, from, to) {
        const fromDate = (0, date_util_1.parseDateOnly)(from);
        const toDate = (0, date_util_1.parseDateOnly)(to);
        const foods = await this.prisma.foodLog.findMany({
            where: { userId, deletedAt: null, logDate: { gte: fromDate, lte: toDate } },
            orderBy: [{ logDate: 'desc' }, { consumedAt: 'desc' }],
        });
        const activities = await this.prisma.activityLog.findMany({
            where: { userId, deletedAt: null, logDate: { gte: fromDate, lte: toDate } },
            orderBy: [{ logDate: 'desc' }, { startedAt: 'desc' }],
            include: { activityType: true },
        });
        const timeline = [
            ...foods.map((f) => ({
                kind: 'food',
                id: f.id,
                log_date: f.logDate.toISOString().slice(0, 10),
                at: f.consumedAt.toISOString(),
                title: f.title,
                calories: f.totalCalories,
                meal_type: f.mealType,
            })),
            ...activities.map((a) => ({
                kind: 'activity',
                id: a.id,
                log_date: a.logDate.toISOString().slice(0, 10),
                at: a.startedAt?.toISOString() ?? null,
                title: a.activityType?.name ?? a.customName ?? 'Aktivitas',
                calories: a.caloriesBurned,
                duration_minutes: a.durationMinutes,
            })),
        ].sort((a, b) => {
            const ta = a.at ?? a.log_date;
            const tb = b.at ?? b.log_date;
            return tb.localeCompare(ta);
        });
        return { from, to, data: timeline };
    }
};
exports.DashboardService = DashboardService;
exports.DashboardService = DashboardService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], DashboardService);
//# sourceMappingURL=dashboard.service.js.map