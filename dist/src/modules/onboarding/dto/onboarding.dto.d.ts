import { ActivityLevel, FitnessGoal, MetabolicFormula, UnitSystem } from '@prisma/client';
export declare class PreviewTargetDto {
    dateOfBirth: string;
    heightCm: number;
    weightKg: number;
    metabolicFormula: MetabolicFormula;
    activityLevel?: ActivityLevel;
    fitnessGoal: FitnessGoal;
    targetRate?: number;
    manualTarget?: number;
}
export declare class CompleteOnboardingDto extends PreviewTargetDto {
    displayName?: string;
    timezone?: string;
    unitSystem?: UnitSystem;
    estimatesAccepted: boolean;
}
