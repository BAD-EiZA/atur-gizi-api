"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GeminiClient = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const genai_1 = require("@google/genai");
const FOOD_SCHEMA = {
    type: 'object',
    properties: {
        detected_items: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    name: { type: 'string' },
                    local_name: { type: 'string', nullable: true },
                    estimated_portion: {
                        type: 'object',
                        properties: {
                            amount: { type: 'number' },
                            unit: { type: 'string' },
                        },
                        required: ['amount', 'unit'],
                    },
                    estimated_calories: { type: 'number' },
                    macros: {
                        type: 'object',
                        properties: {
                            protein_g: { type: 'number' },
                            carbs_g: { type: 'number' },
                            fat_g: { type: 'number' },
                            fiber_g: { type: 'number' },
                        },
                        required: ['protein_g', 'carbs_g', 'fat_g'],
                    },
                    confidence: { type: 'number' },
                    assumptions: { type: 'array', items: { type: 'string' } },
                },
                required: [
                    'name',
                    'estimated_portion',
                    'estimated_calories',
                    'macros',
                    'confidence',
                    'assumptions',
                ],
            },
        },
        total_estimated_calories: { type: 'number' },
        overall_confidence: { type: 'number' },
        image_quality: { type: 'string', enum: ['good', 'usable', 'poor'] },
        needs_user_input: { type: 'boolean' },
        follow_up_questions: { type: 'array', items: { type: 'string' } },
        warnings: { type: 'array', items: { type: 'string' } },
    },
    required: [
        'detected_items',
        'total_estimated_calories',
        'overall_confidence',
        'image_quality',
        'needs_user_input',
        'follow_up_questions',
        'warnings',
    ],
};
const SYSTEM_PROMPT = `Anda adalah asisten estimasi nutrisi. Analisis foto makanan.
Aturan:
- Identifikasi item yang terlihat; pisahkan item berbeda.
- Estimasi porsi, kalori, dan makronutrien; nyatakan asumsi.
- Confidence 0-1; image_quality good|usable|poor.
- Jangan diagnosis medis, jangan klaim presisi, jangan mengarang merek/bahan tersembunyi sebagai fakta.
- Jika bukan makanan atau tidak jelas, isi needs_user_input true dan warnings.
- Hanya keluarkan JSON sesuai schema. Bahasa nama item: Indonesia bila relevan.`;
let GeminiClient = class GeminiClient {
    config;
    constructor(config) {
        this.config = config;
    }
    get promptVersion() {
        return 'food_analysis_prompt_v1';
    }
    get schemaVersion() {
        return 'food_analysis_schema_v1';
    }
    get model() {
        return this.config.get('gemini.model') ?? 'gemini-3.1-flash-lite';
    }
    isConfigured() {
        return Boolean(this.config.get('gemini.apiKey'));
    }
    async analyzeImage(input) {
        if (!this.isConfigured()) {
            return this.mockResult();
        }
        const ai = new genai_1.GoogleGenAI({ apiKey: this.config.get('gemini.apiKey') });
        const parts = [{ text: SYSTEM_PROMPT + '\nLocale: id-ID. Estimasi untuk porsi yang terlihat.' }];
        if (input.imageBase64) {
            parts.push({
                inlineData: {
                    mimeType: input.mimeType ?? 'image/jpeg',
                    data: input.imageBase64.replace(/^data:[^;]+;base64,/, ''),
                },
            });
        }
        else if (input.imageUrl) {
            parts.push({
                fileData: {
                    fileUri: input.imageUrl,
                    mimeType: input.mimeType ?? 'image/jpeg',
                },
            });
        }
        else {
            throw new Error('no_image');
        }
        const response = await ai.models.generateContent({
            model: this.model,
            contents: [{ role: 'user', parts }],
            config: {
                responseMimeType: 'application/json',
                responseSchema: FOOD_SCHEMA,
                temperature: 0.2,
            },
        });
        const text = response.text;
        if (!text)
            throw new Error('empty_response');
        return JSON.parse(text);
    }
    mockResult() {
        return {
            detected_items: [
                {
                    name: 'Nasi putih',
                    local_name: 'Nasi',
                    estimated_portion: { amount: 150, unit: 'g' },
                    estimated_calories: 195,
                    macros: { protein_g: 4, carbs_g: 42, fat_g: 0.4, fiber_g: 0.6 },
                    confidence: 0.72,
                    assumptions: ['Porsi satu centong sedang', 'Nasi putih matang'],
                },
                {
                    name: 'Ayam goreng',
                    local_name: null,
                    estimated_portion: { amount: 1, unit: 'piece' },
                    estimated_calories: 250,
                    macros: { protein_g: 22, carbs_g: 8, fat_g: 14, fiber_g: 0 },
                    confidence: 0.65,
                    assumptions: ['Satu potong paha/dada sedang', 'Digoreng'],
                },
            ],
            total_estimated_calories: 445,
            overall_confidence: 0.68,
            image_quality: 'usable',
            needs_user_input: true,
            follow_up_questions: ['Berapa porsi nasi sebenarnya?'],
            warnings: ['Mode mock: Gemini API key belum diset. Koreksi sebelum simpan.'],
        };
    }
};
exports.GeminiClient = GeminiClient;
exports.GeminiClient = GeminiClient = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], GeminiClient);
//# sourceMappingURL=gemini.client.js.map