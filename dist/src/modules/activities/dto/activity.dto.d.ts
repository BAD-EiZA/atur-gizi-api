import { Intensity } from '@prisma/client';
export declare class EstimateActivityDto {
    activityTypeId?: string;
    metValue?: number;
    durationMinutes: number;
    weightKg?: number;
}
export declare class CreateActivityLogDto {
    activityTypeId?: string;
    customName?: string;
    startedAt?: string;
    logDate?: string;
    durationMinutes: number;
    intensity?: Intensity;
    metValue?: number;
    caloriesBurned?: number;
    notes?: string;
}
export declare class UpdateActivityLogDto {
    durationMinutes?: number;
    intensity?: Intensity;
    caloriesBurned?: number;
    notes?: string;
    startedAt?: string;
}
