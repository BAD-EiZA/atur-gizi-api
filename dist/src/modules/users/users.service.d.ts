import { PrismaService } from '../../prisma/prisma.service';
import { AuthClaims } from '../../common/auth/auth.types';
import { PatchProfileDto, PatchSettingsDto } from './dto/profile.dto';
import { computeTarget } from '../../common/utils/nutrition.util';
import { ConfigService } from '@nestjs/config';
import { FitnessGoal } from '@prisma/client';
export declare class UsersService {
    private readonly prisma;
    private readonly config;
    constructor(prisma: PrismaService, config: ConfigService);
    sync(claims: AuthClaims): Promise<{
        id: string;
        kinde_user_id: string;
        email: string | null;
        display_name: string | null;
        status: string;
        onboarding_completed: boolean;
        profile: {
            date_of_birth: string | null;
            height_cm: number | null;
            current_weight_kg: number | null;
            metabolic_formula: string;
            activity_level: string | null;
            fitness_goal: string | null;
            target_rate: number | null;
            estimates_accepted: boolean;
        } | null;
        settings: {
            timezone: string;
            unit_system: string;
            locale: string;
            retain_food_photos: boolean;
            analytics_consent: boolean;
        } | null;
    }>;
    me(appUserId: string): Promise<{
        id: string;
        kinde_user_id: string;
        email: string | null;
        display_name: string | null;
        status: string;
        onboarding_completed: boolean;
        profile: {
            date_of_birth: string | null;
            height_cm: number | null;
            current_weight_kg: number | null;
            metabolic_formula: string;
            activity_level: string | null;
            fitness_goal: string | null;
            target_rate: number | null;
            estimates_accepted: boolean;
        } | null;
        settings: {
            timezone: string;
            unit_system: string;
            locale: string;
            retain_food_photos: boolean;
            analytics_consent: boolean;
        } | null;
    }>;
    patchProfile(appUserId: string, dto: PatchProfileDto): Promise<{
        id: string;
        kinde_user_id: string;
        email: string | null;
        display_name: string | null;
        status: string;
        onboarding_completed: boolean;
        profile: {
            date_of_birth: string | null;
            height_cm: number | null;
            current_weight_kg: number | null;
            metabolic_formula: string;
            activity_level: string | null;
            fitness_goal: string | null;
            target_rate: number | null;
            estimates_accepted: boolean;
        } | null;
        settings: {
            timezone: string;
            unit_system: string;
            locale: string;
            retain_food_photos: boolean;
            analytics_consent: boolean;
        } | null;
    }>;
    patchSettings(appUserId: string, dto: PatchSettingsDto): Promise<{
        id: string;
        kinde_user_id: string;
        email: string | null;
        display_name: string | null;
        status: string;
        onboarding_completed: boolean;
        profile: {
            date_of_birth: string | null;
            height_cm: number | null;
            current_weight_kg: number | null;
            metabolic_formula: string;
            activity_level: string | null;
            fitness_goal: string | null;
            target_rate: number | null;
            estimates_accepted: boolean;
        } | null;
        settings: {
            timezone: string;
            unit_system: string;
            locale: string;
            retain_food_photos: boolean;
            analytics_consent: boolean;
        } | null;
    }>;
    assertMinAge(dateOfBirth: string): void;
    createTargetSnapshot(appUserId: string, input: {
        formula: Parameters<typeof computeTarget>[0]['formula'];
        weightKg: number;
        heightCm: number;
        ageYears: number;
        activityLevel: Parameters<typeof computeTarget>[0]['activityLevel'];
        goal: FitnessGoal;
        targetRatePct?: number | null;
        manualTarget?: number | null;
        effectiveFrom: Date;
    }): Promise<{
        id: string;
        createdAt: Date;
        userId: string;
        effectiveFrom: Date;
        effectiveTo: Date | null;
        bmrKcal: number | null;
        tdeeKcal: number | null;
        calorieTarget: number;
        goal: import(".prisma/client").$Enums.FitnessGoal;
        calculationMethod: string;
        calculationInputs: import("@prisma/client/runtime/library").JsonValue;
    }>;
    private toMe;
}
