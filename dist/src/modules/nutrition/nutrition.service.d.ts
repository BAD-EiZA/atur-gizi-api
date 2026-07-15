import { FoodLogSource, MealType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateFoodLogDto, UpdateFoodLogDto } from './dto/food-log.dto';
export declare class NutritionService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    private sumItems;
    private timezone;
    create(userId: string, dto: CreateFoodLogDto, source?: FoodLogSource, extra?: {
        aiAnalysisId?: string;
        cloudinaryPublicId?: string | null;
        mediaDeliveryType?: string | null;
    }): Promise<{
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
    list(userId: string, query: {
        from?: string;
        to?: string;
        mealType?: MealType;
        cursor?: string;
        limit?: number;
    }): Promise<{
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
    get(userId: string, id: string): Promise<{
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
    update(userId: string, id: string, dto: UpdateFoodLogDto): Promise<{
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
    remove(userId: string, id: string): Promise<{
        ok: boolean;
    }>;
    private serialize;
}
