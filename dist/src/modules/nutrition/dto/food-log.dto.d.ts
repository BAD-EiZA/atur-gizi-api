import { MealType } from '@prisma/client';
export declare class FoodItemDto {
    name: string;
    portionAmount: number;
    portionUnit: string;
    calories: number;
    proteinG?: number;
    carbsG?: number;
    fatG?: number;
    fiberG?: number;
    aiConfidence?: number;
}
export declare class CreateFoodLogDto {
    consumedAt: string;
    logDate?: string;
    mealType: MealType;
    title: string;
    items: FoodItemDto[];
    notes?: string;
}
export declare class UpdateFoodLogDto {
    consumedAt?: string;
    mealType?: MealType;
    title?: string;
    items?: FoodItemDto[];
    notes?: string;
}
