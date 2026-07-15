import { MealType } from '@prisma/client';
export declare class StartAnalysisDto {
    cloudinaryPublicId: string;
    mediaDeliveryType?: string;
    mediaVersion?: string;
    mediaFormat?: string;
    mediaBytes?: number;
    imageBase64?: string;
    mimeType?: string;
}
export declare class ConfirmItemDto {
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
export declare class ConfirmAnalysisDto {
    mealType: MealType;
    consumedAt: string;
    title?: string;
    items: ConfirmItemDto[];
    notes?: string;
}
