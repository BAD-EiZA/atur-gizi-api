import { ConfigService } from '@nestjs/config';
export type GeminiFoodResult = {
    detected_items: Array<{
        name: string;
        local_name?: string | null;
        estimated_portion: {
            amount: number;
            unit: string;
        };
        estimated_calories: number;
        macros: {
            protein_g: number;
            carbs_g: number;
            fat_g: number;
            fiber_g?: number;
        };
        confidence: number;
        assumptions: string[];
    }>;
    total_estimated_calories: number;
    overall_confidence: number;
    image_quality: 'good' | 'usable' | 'poor';
    needs_user_input: boolean;
    follow_up_questions: string[];
    warnings: string[];
};
export declare class GeminiClient {
    private readonly config;
    constructor(config: ConfigService);
    get promptVersion(): string;
    get schemaVersion(): string;
    get model(): string;
    isConfigured(): boolean;
    analyzeImage(input: {
        imageBase64?: string;
        mimeType?: string;
        imageUrl?: string;
    }): Promise<GeminiFoodResult>;
    mockResult(): GeminiFoodResult;
}
