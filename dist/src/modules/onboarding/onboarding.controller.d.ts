import { AuthenticatedUser } from '../../common/auth/auth.types';
import { OnboardingService } from './onboarding.service';
import { CompleteOnboardingDto, PreviewTargetDto } from './dto/onboarding.dto';
import { IdempotencyService } from '../../common/idempotency/idempotency.service';
import { AnalyticsService } from '../../common/analytics/analytics.service';
export declare class OnboardingController {
    private readonly onboarding;
    private readonly idempotency;
    private readonly analytics;
    constructor(onboarding: OnboardingService, idempotency: IdempotencyService, analytics: AnalyticsService);
    preview(dto: PreviewTargetDto): {
        age_years: number;
        bmr_kcal: number | null;
        tdee_kcal: number | null;
        calorie_target: number;
        calculation_method: string;
        formula_version: string;
        calculation_inputs: {
            formula: import(".prisma/client").MetabolicFormula;
            weightKg: number;
            heightCm: number;
            ageYears: number;
            activityLevel: import(".prisma/client").ActivityLevel | null;
            goal: import(".prisma/client").FitnessGoal;
            targetRatePct?: number | null;
            manualTarget?: number | null;
            activityFactor?: undefined;
        } | {
            formula: "mifflin_a" | "mifflin_b";
            weightKg: number;
            heightCm: number;
            ageYears: number;
            activityLevel: import(".prisma/client").$Enums.ActivityLevel;
            goal: "lose_weight" | "maintain" | "gain_weight";
            targetRatePct: number | null;
            activityFactor: number;
        };
        disclaimer: string;
    };
    complete(user: AuthenticatedUser, dto: CompleteOnboardingDto, idemKey?: string): Promise<import("@prisma/client/runtime/library").JsonValue | {
        onboarding_completed: boolean;
        age_years: number;
        bmr_kcal: number | null;
        tdee_kcal: number | null;
        calorie_target: number;
        calculation_method: string;
        formula_version: string;
        calculation_inputs: {
            formula: import(".prisma/client").MetabolicFormula;
            weightKg: number;
            heightCm: number;
            ageYears: number;
            activityLevel: import(".prisma/client").ActivityLevel | null;
            goal: import(".prisma/client").FitnessGoal;
            targetRatePct?: number | null;
            manualTarget?: number | null;
            activityFactor?: undefined;
        } | {
            formula: "mifflin_a" | "mifflin_b";
            weightKg: number;
            heightCm: number;
            ageYears: number;
            activityLevel: import(".prisma/client").$Enums.ActivityLevel;
            goal: "lose_weight" | "maintain" | "gain_weight";
            targetRatePct: number | null;
            activityFactor: number;
        };
        disclaimer: string;
    }>;
}
