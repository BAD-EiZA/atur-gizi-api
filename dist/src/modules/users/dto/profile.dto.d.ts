import { ActivityLevel, FitnessGoal, MetabolicFormula, UnitSystem } from '@prisma/client';
export declare class PatchProfileDto {
    displayName?: string;
    dateOfBirth?: string;
    heightCm?: number;
    currentWeightKg?: number;
    metabolicFormula?: MetabolicFormula;
    activityLevel?: ActivityLevel;
    fitnessGoal?: FitnessGoal;
    targetRate?: number;
}
export declare class PatchSettingsDto {
    timezone?: string;
    unitSystem?: UnitSystem;
    locale?: string;
    retainFoodPhotos?: boolean;
    analyticsConsent?: boolean;
}
