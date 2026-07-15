import { PrismaService } from '../../prisma/prisma.service';
import { CreateActivityLogDto, EstimateActivityDto, UpdateActivityLogDto } from './dto/activity.dto';
export declare class ActivitiesService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    listTypes(): Promise<{
        data: {
            id: string;
            slug: string;
            name: string;
            category: string;
            default_met: number;
        }[];
    }>;
    private weightKg;
    estimate(userId: string, dto: EstimateActivityDto): Promise<{
        met_value: number;
        weight_kg: number;
        duration_minutes: number;
        calculated_calories: number;
        formula_version: string;
    }>;
    create(userId: string, dto: CreateActivityLogDto): Promise<{
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
    list(userId: string, query: {
        from?: string;
        to?: string;
        cursor?: string;
        limit?: number;
    }): Promise<{
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
    get(userId: string, id: string): Promise<{
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
    update(userId: string, id: string, dto: UpdateActivityLogDto): Promise<{
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
    remove(userId: string, id: string): Promise<{
        ok: boolean;
    }>;
    private serialize;
}
