import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { MediaService } from '../media/media.service';
import { NutritionService } from '../nutrition/nutrition.service';
import { GeminiClient, GeminiFoodResult } from './gemini.client';
import { ConfirmAnalysisDto, StartAnalysisDto } from './dto/ai.dto';
export declare class AiService {
    private readonly prisma;
    private readonly media;
    private readonly nutrition;
    private readonly gemini;
    private readonly config;
    constructor(prisma: PrismaService, media: MediaService, nutrition: NutritionService, gemini: GeminiClient, config: ConfigService);
    private consumeQuota;
    normalize(raw: GeminiFoodResult): {
        items: {
            name: string;
            local_name: string | null;
            portion_amount: number;
            portion_unit: string;
            calories: number;
            protein_g: number;
            carbs_g: number;
            fat_g: number;
            fiber_g: number;
            confidence: number;
            confidence_label: "Tinggi" | "Sedang" | "Rendah";
            assumptions: string[];
        }[];
        total_estimated_calories: number;
        overall_confidence: number;
        overall_confidence_label: "Tinggi" | "Sedang" | "Rendah";
        image_quality: "good" | "usable" | "poor";
        needs_user_input: boolean;
        follow_up_questions: string[];
        warnings: string[];
    };
    start(userId: string, dto: StartAnalysisDto): Promise<{
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
    get(userId: string, id: string): Promise<{
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
    retry(userId: string, id: string): Promise<{
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
    confirm(userId: string, id: string, dto: ConfirmAnalysisDto): Promise<{
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
    cancel(userId: string, id: string): Promise<{
        ok: boolean;
    }>;
    private maybeDeletePhoto;
    private serialize;
}
