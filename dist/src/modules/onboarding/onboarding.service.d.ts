import { UsersService } from '../users/users.service';
import { CompleteOnboardingDto, PreviewTargetDto } from './dto/onboarding.dto';
import { PrismaService } from '../../prisma/prisma.service';
export declare class OnboardingService {
    private readonly users;
    private readonly prisma;
    constructor(users: UsersService, prisma: PrismaService);
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
    complete(appUserId: string, dto: CompleteOnboardingDto): Promise<{
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
