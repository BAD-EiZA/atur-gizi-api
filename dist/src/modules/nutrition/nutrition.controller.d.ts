import { AuthenticatedUser } from '../../common/auth/auth.types';
import { NutritionService } from './nutrition.service';
import { CreateFoodLogDto, UpdateFoodLogDto } from './dto/food-log.dto';
import { MealType } from '@prisma/client';
import { IdempotencyService } from '../../common/idempotency/idempotency.service';
import { AnalyticsService } from '../../common/analytics/analytics.service';
export declare class NutritionController {
    private readonly nutrition;
    private readonly idempotency;
    private readonly analytics;
    constructor(nutrition: NutritionService, idempotency: IdempotencyService, analytics: AnalyticsService);
    create(user: AuthenticatedUser, dto: CreateFoodLogDto, idemKey?: string): Promise<import("@prisma/client/runtime/library").JsonValue | {
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
    }>;
    list(user: AuthenticatedUser, from?: string, to?: string, mealType?: MealType, cursor?: string, limit?: string): Promise<{
        data: {
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
        }[];
        next_cursor: string | null;
    }>;
    get(user: AuthenticatedUser, id: string): Promise<{
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
    }>;
    update(user: AuthenticatedUser, id: string, dto: UpdateFoodLogDto): Promise<{
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
    }>;
    remove(user: AuthenticatedUser, id: string): Promise<{
        ok: boolean;
    }>;
}
