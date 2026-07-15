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
exports.OnboardingService = void 0;
const common_1 = require("@nestjs/common");
const users_service_1 = require("../users/users.service");
const date_util_1 = require("../../common/utils/date.util");
const nutrition_util_1 = require("../../common/utils/nutrition.util");
const app_exception_1 = require("../../common/errors/app.exception");
const prisma_service_1 = require("../../prisma/prisma.service");
let OnboardingService = class OnboardingService {
    users;
    prisma;
    constructor(users, prisma) {
        this.users = users;
        this.prisma = prisma;
    }
    preview(dto) {
        this.users.assertMinAge(dto.dateOfBirth);
        const ageYears = (0, date_util_1.ageFromDob)((0, date_util_1.parseDateOnly)(dto.dateOfBirth));
        try {
            const result = (0, nutrition_util_1.computeTarget)({
                formula: dto.metabolicFormula,
                weightKg: dto.weightKg,
                heightCm: dto.heightCm,
                ageYears,
                activityLevel: dto.activityLevel ?? null,
                goal: dto.fitnessGoal,
                targetRatePct: dto.targetRate,
                manualTarget: dto.manualTarget,
            });
            return {
                age_years: ageYears,
                bmr_kcal: result.bmrKcal,
                tdee_kcal: result.tdeeKcal,
                calorie_target: result.calorieTarget,
                calculation_method: result.calculationMethod,
                formula_version: result.formulaVersion,
                calculation_inputs: result.calculationInputs,
                disclaimer: 'Estimasi kalori dan nutrisi dapat tidak akurat. Aplikasi ini bukan pengganti nasihat medis atau ahli gizi.',
            };
        }
        catch (e) {
            throw new app_exception_1.AppException('TARGET_CALCULATION_FAILED', e instanceof Error ? e.message : 'Gagal menghitung target.', common_1.HttpStatus.BAD_REQUEST);
        }
    }
    async complete(appUserId, dto) {
        if (!dto.estimatesAccepted) {
            throw new app_exception_1.AppException('ESTIMATES_NOT_ACCEPTED', 'Anda harus menyetujui bahwa angka adalah estimasi.', common_1.HttpStatus.BAD_REQUEST);
        }
        this.users.assertMinAge(dto.dateOfBirth);
        const preview = this.preview(dto);
        const dob = (0, date_util_1.parseDateOnly)(dto.dateOfBirth);
        const timezone = dto.timezone ?? 'Asia/Jakarta';
        const today = (0, date_util_1.parseDateOnly)((0, date_util_1.localDateString)(new Date(), timezone));
        await this.prisma.$transaction(async (tx) => {
            if (dto.displayName) {
                await tx.appUser.update({
                    where: { id: appUserId },
                    data: { displayName: dto.displayName },
                });
            }
            await tx.userProfile.update({
                where: { userId: appUserId },
                data: {
                    dateOfBirth: dob,
                    heightCm: dto.heightCm,
                    currentWeightKg: dto.weightKg,
                    metabolicFormula: dto.metabolicFormula,
                    activityLevel: dto.activityLevel,
                    fitnessGoal: dto.fitnessGoal,
                    targetRate: dto.targetRate,
                    formulaVersion: preview.formula_version,
                    estimatesAccepted: true,
                    onboardingCompleted: true,
                },
            });
            await tx.userSettings.update({
                where: { userId: appUserId },
                data: {
                    timezone,
                    unitSystem: dto.unitSystem ?? 'metric',
                },
            });
            const open = await tx.dailyTarget.findFirst({
                where: { userId: appUserId, effectiveTo: null },
                orderBy: { effectiveFrom: 'desc' },
            });
            if (open) {
                const dayBefore = new Date(today);
                dayBefore.setUTCDate(dayBefore.getUTCDate() - 1);
                await tx.dailyTarget.update({
                    where: { id: open.id },
                    data: { effectiveTo: dayBefore },
                });
            }
            await tx.dailyTarget.create({
                data: {
                    userId: appUserId,
                    effectiveFrom: today,
                    bmrKcal: preview.bmr_kcal,
                    tdeeKcal: preview.tdee_kcal,
                    calorieTarget: preview.calorie_target,
                    goal: dto.fitnessGoal,
                    calculationMethod: preview.calculation_method,
                    calculationInputs: preview.calculation_inputs,
                },
            });
        });
        return {
            ...preview,
            onboarding_completed: true,
        };
    }
};
exports.OnboardingService = OnboardingService;
exports.OnboardingService = OnboardingService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [users_service_1.UsersService,
        prisma_service_1.PrismaService])
], OnboardingService);
//# sourceMappingURL=onboarding.service.js.map