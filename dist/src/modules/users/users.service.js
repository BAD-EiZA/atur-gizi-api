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
exports.UsersService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const app_exception_1 = require("../../common/errors/app.exception");
const common_2 = require("@nestjs/common");
const nutrition_util_1 = require("../../common/utils/nutrition.util");
const date_util_1 = require("../../common/utils/date.util");
const config_1 = require("@nestjs/config");
let UsersService = class UsersService {
    prisma;
    config;
    constructor(prisma, config) {
        this.prisma = prisma;
        this.config = config;
    }
    async sync(claims) {
        const displayName = claims.name ||
            [claims.given_name, claims.family_name].filter(Boolean).join(' ') ||
            claims.email ||
            null;
        const user = await this.prisma.appUser.upsert({
            where: { kindeUserId: claims.sub },
            create: {
                kindeUserId: claims.sub,
                email: claims.email ?? null,
                displayName,
                profile: { create: {} },
                settings: { create: {} },
            },
            update: {
                email: claims.email ?? undefined,
                displayName: displayName ?? undefined,
            },
            include: { profile: true, settings: true },
        });
        return this.toMe(user);
    }
    async me(appUserId) {
        if (!appUserId) {
            throw new app_exception_1.AppException('USER_NOT_SYNCED', 'Panggil /v1/users/sync terlebih dahulu.', common_2.HttpStatus.NOT_FOUND);
        }
        const user = await this.prisma.appUser.findUnique({
            where: { id: appUserId },
            include: { profile: true, settings: true },
        });
        if (!user) {
            throw new app_exception_1.AppException('USER_NOT_FOUND', 'Pengguna tidak ditemukan.', common_2.HttpStatus.NOT_FOUND);
        }
        return this.toMe(user);
    }
    async patchProfile(appUserId, dto) {
        const user = await this.prisma.appUser.findUnique({
            where: { id: appUserId },
            include: { profile: true },
        });
        if (!user?.profile) {
            throw new app_exception_1.AppException('USER_NOT_FOUND', 'Pengguna tidak ditemukan.', common_2.HttpStatus.NOT_FOUND);
        }
        if (dto.dateOfBirth) {
            this.assertMinAge(dto.dateOfBirth);
        }
        await this.prisma.$transaction(async (tx) => {
            if (dto.displayName !== undefined) {
                await tx.appUser.update({
                    where: { id: appUserId },
                    data: { displayName: dto.displayName },
                });
            }
            await tx.userProfile.update({
                where: { userId: appUserId },
                data: {
                    dateOfBirth: dto.dateOfBirth ? (0, date_util_1.parseDateOnly)(dto.dateOfBirth) : undefined,
                    heightCm: dto.heightCm,
                    currentWeightKg: dto.currentWeightKg,
                    metabolicFormula: dto.metabolicFormula,
                    activityLevel: dto.activityLevel,
                    fitnessGoal: dto.fitnessGoal,
                    targetRate: dto.targetRate,
                },
            });
        });
        return this.me(appUserId);
    }
    async patchSettings(appUserId, dto) {
        await this.prisma.userSettings.update({
            where: { userId: appUserId },
            data: {
                timezone: dto.timezone,
                unitSystem: dto.unitSystem,
                locale: dto.locale,
                retainFoodPhotos: dto.retainFoodPhotos,
                analyticsConsent: dto.analyticsConsent,
            },
        });
        return this.me(appUserId);
    }
    assertMinAge(dateOfBirth) {
        const dob = (0, date_util_1.parseDateOnly)(dateOfBirth);
        const age = (0, date_util_1.ageFromDob)(dob);
        const min = this.config.get('minUserAge') ?? 15;
        if (age < min) {
            throw new app_exception_1.AppException('ONBOARDING_AGE_RESTRICTED', `Usia minimum pengguna adalah ${min} tahun.`, common_2.HttpStatus.BAD_REQUEST);
        }
    }
    async createTargetSnapshot(appUserId, input) {
        const computed = (0, nutrition_util_1.computeTarget)(input);
        const latest = await this.prisma.dailyTarget.findFirst({
            where: { userId: appUserId, effectiveTo: null },
            orderBy: { effectiveFrom: 'desc' },
        });
        if (latest) {
            const dayBefore = new Date(input.effectiveFrom);
            dayBefore.setUTCDate(dayBefore.getUTCDate() - 1);
            await this.prisma.dailyTarget.update({
                where: { id: latest.id },
                data: { effectiveTo: dayBefore },
            });
        }
        return this.prisma.dailyTarget.create({
            data: {
                userId: appUserId,
                effectiveFrom: input.effectiveFrom,
                bmrKcal: computed.bmrKcal,
                tdeeKcal: computed.tdeeKcal,
                calorieTarget: computed.calorieTarget,
                goal: input.goal,
                calculationMethod: computed.calculationMethod,
                calculationInputs: computed.calculationInputs,
            },
        });
    }
    toMe(user) {
        const num = (v) => {
            if (v == null)
                return null;
            if (typeof v === 'number')
                return v;
            return v.toNumber ? v.toNumber() : Number(v);
        };
        return {
            id: user.id,
            kinde_user_id: user.kindeUserId,
            email: user.email,
            display_name: user.displayName,
            status: user.status,
            onboarding_completed: user.profile?.onboardingCompleted ?? false,
            profile: user.profile
                ? {
                    date_of_birth: user.profile.dateOfBirth
                        ? user.profile.dateOfBirth.toISOString().slice(0, 10)
                        : null,
                    height_cm: num(user.profile.heightCm),
                    current_weight_kg: num(user.profile.currentWeightKg),
                    metabolic_formula: user.profile.metabolicFormula,
                    activity_level: user.profile.activityLevel,
                    fitness_goal: user.profile.fitnessGoal,
                    target_rate: num(user.profile.targetRate),
                    estimates_accepted: user.profile.estimatesAccepted,
                }
                : null,
            settings: user.settings
                ? {
                    timezone: user.settings.timezone,
                    unit_system: user.settings.unitSystem,
                    locale: user.settings.locale,
                    retain_food_photos: user.settings.retainFoodPhotos,
                    analytics_consent: user.settings.analyticsConsent,
                }
                : null,
        };
    }
};
exports.UsersService = UsersService;
exports.UsersService = UsersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        config_1.ConfigService])
], UsersService);
//# sourceMappingURL=users.service.js.map