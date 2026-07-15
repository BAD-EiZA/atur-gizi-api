import { AuthenticatedUser } from '../../common/auth/auth.types';
import { ActivitiesService } from './activities.service';
import { CreateActivityLogDto, EstimateActivityDto, UpdateActivityLogDto } from './dto/activity.dto';
export declare class ActivitiesController {
    private readonly activities;
    constructor(activities: ActivitiesService);
    types(): Promise<{
        data: {
            id: string;
            slug: string;
            name: string;
            category: string;
            default_met: number;
        }[];
    }>;
    estimate(user: AuthenticatedUser, dto: EstimateActivityDto): Promise<{
        met_value: number;
        weight_kg: number;
        duration_minutes: number;
        calculated_calories: number;
        formula_version: string;
    }>;
    create(user: AuthenticatedUser, dto: CreateActivityLogDto): Promise<{
        id: string;
        log_date: string;
        started_at: string | null;
        duration_minutes: number;
        intensity: import(".prisma/client").$Enums.Intensity;
        met_value: number;
        weight_snapshot_kg: number;
        calculated_calories: number;
        calories_burned: number;
        formula_version: string;
        notes: string | null;
        name: string;
        activity_type: {
            id: string;
            name: string;
            slug: string;
        } | null;
    }>;
    list(user: AuthenticatedUser, from?: string, to?: string, cursor?: string, limit?: string): Promise<{
        data: {
            id: string;
            log_date: string;
            started_at: string | null;
            duration_minutes: number;
            intensity: import(".prisma/client").$Enums.Intensity;
            met_value: number;
            weight_snapshot_kg: number;
            calculated_calories: number;
            calories_burned: number;
            formula_version: string;
            notes: string | null;
            name: string;
            activity_type: {
                id: string;
                name: string;
                slug: string;
            } | null;
        }[];
        next_cursor: string | null;
    }>;
    get(user: AuthenticatedUser, id: string): Promise<{
        id: string;
        log_date: string;
        started_at: string | null;
        duration_minutes: number;
        intensity: import(".prisma/client").$Enums.Intensity;
        met_value: number;
        weight_snapshot_kg: number;
        calculated_calories: number;
        calories_burned: number;
        formula_version: string;
        notes: string | null;
        name: string;
        activity_type: {
            id: string;
            name: string;
            slug: string;
        } | null;
    }>;
    update(user: AuthenticatedUser, id: string, dto: UpdateActivityLogDto): Promise<{
        id: string;
        log_date: string;
        started_at: string | null;
        duration_minutes: number;
        intensity: import(".prisma/client").$Enums.Intensity;
        met_value: number;
        weight_snapshot_kg: number;
        calculated_calories: number;
        calories_burned: number;
        formula_version: string;
        notes: string | null;
        name: string;
        activity_type: {
            id: string;
            name: string;
            slug: string;
        } | null;
    }>;
    remove(user: AuthenticatedUser, id: string): Promise<{
        ok: boolean;
    }>;
}
