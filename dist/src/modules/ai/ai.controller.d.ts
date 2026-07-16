import { AuthenticatedUser } from '../../common/auth/auth.types';
import { AiService } from './ai.service';
import { ConfirmAnalysisDto, StartAnalysisDto } from './dto/ai.dto';
import { RateLimitService } from '../../common/rate-limit/rate-limit.service';
import { IdempotencyService } from '../../common/idempotency/idempotency.service';
import { AnalyticsService } from '../../common/analytics/analytics.service';
import type { Request } from 'express';
export declare class AiController {
    private readonly ai;
    private readonly rateLimit;
    private readonly idempotency;
    private readonly analytics;
    constructor(ai: AiService, rateLimit: RateLimitService, idempotency: IdempotencyService, analytics: AnalyticsService);
    start(user: AuthenticatedUser, dto: StartAnalysisDto, req: Request): Promise<{
        id: string;
        status: string;
        model: string;
        prompt_version: string;
        schema_version: string;
        latency_ms: number | null;
        overall_confidence: number | null;
        result: unknown;
        failure_code: string | null;
        created_at: string;
        confirmed_at: string | null;
        photo_policy: string;
        quota: {
            used: number;
            quota: number;
            remaining: number;
        } | undefined;
        disclaimer: string;
    }>;
    get(user: AuthenticatedUser, id: string): Promise<{
        id: string;
        status: string;
        model: string;
        prompt_version: string;
        schema_version: string;
        latency_ms: number | null;
        overall_confidence: number | null;
        result: unknown;
        failure_code: string | null;
        created_at: string;
        confirmed_at: string | null;
        photo_policy: string;
        quota: {
            used: number;
            quota: number;
            remaining: number;
        } | undefined;
        disclaimer: string;
    }>;
    retry(user: AuthenticatedUser, id: string): Promise<{
        id: string;
        status: string;
        model: string;
        prompt_version: string;
        schema_version: string;
        latency_ms: number | null;
        overall_confidence: number | null;
        result: unknown;
        failure_code: string | null;
        created_at: string;
        confirmed_at: string | null;
        photo_policy: string;
        quota: {
            used: number;
            quota: number;
            remaining: number;
        } | undefined;
        disclaimer: string;
    }>;
    confirm(user: AuthenticatedUser, id: string, dto: ConfirmAnalysisDto, idemKey?: string): Promise<import("@prisma/client/runtime/library").JsonValue | {
        analysis_id: string;
        food_log: {
            id: string;
            log_date: string;
            consumed_at: string;
            meal_type: import(".prisma/client").$Enums.MealType;
            title: string;
            total_calories: number;
            protein_g: number | null;
            carbs_g: number | null;
            fat_g: number | null;
            source: import(".prisma/client").$Enums.FoodLogSource;
            notes: string | null;
            items: {
                id: string;
                name: string;
                portion_amount: number;
                portion_unit: string;
                calories: number;
                protein_g: number | null;
                carbs_g: number | null;
                fat_g: number | null;
                fiber_g: number | null;
                ai_confidence: number | null;
                sort_order: number;
            }[];
        };
    }>;
    cancel(user: AuthenticatedUser, id: string): Promise<{
        ok: boolean;
    }>;
}
