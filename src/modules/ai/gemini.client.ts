import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';

export type GeminiFoodResult = {
  detected_items: Array<{
    name: string;
    local_name?: string | null;
    estimated_portion: { amount: number; unit: string };
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

export type GeminiActivityScreenshotResult = {
  is_activity_screen: boolean;
  detected_app:
    | 'apple_health'
    | 'apple_fitness'
    | 'fitbit'
    | 'strava'
    | 'garmin'
    | 'samsung_health'
    | 'google_fit'
    | 'other'
    | 'unknown';
  activity_name: string | null;
  activity_type_guess:
    | 'walking'
    | 'running'
    | 'cycling'
    | 'swimming'
    | 'strength'
    | 'hiit'
    | 'yoga'
    | 'hiking'
    | 'other';
  duration_minutes: number | null;
  calories_burned: number | null;
  distance_m: number | null;
  avg_hr: number | null;
  started_at: string | null;
  intensity_guess: 'low' | 'moderate' | 'high' | null;
  confidence: number;
  image_quality: 'good' | 'usable' | 'poor';
  needs_user_input: boolean;
  fields_found: string[];
  warnings: string[];
};

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
} as const;

const SYSTEM_PROMPT = `Anda adalah asisten estimasi nutrisi. Analisis foto makanan.
Aturan:
- Identifikasi item yang terlihat; pisahkan item berbeda.
- Estimasi porsi, kalori, dan makronutrien; nyatakan asumsi.
- Confidence 0-1; image_quality good|usable|poor.
- Jangan diagnosis medis, jangan klaim presisi, jangan mengarang merek/bahan tersembunyi sebagai fakta.
- Jika bukan makanan atau tidak jelas, isi needs_user_input true dan warnings.
- Hanya keluarkan JSON sesuai schema. Bahasa nama item: Indonesia bila relevan.`;

const ACTIVITY_SCREENSHOT_SCHEMA = {
  type: 'object',
  properties: {
    is_activity_screen: { type: 'boolean' },
    detected_app: {
      type: 'string',
      enum: [
        'apple_health',
        'apple_fitness',
        'fitbit',
        'strava',
        'garmin',
        'samsung_health',
        'google_fit',
        'other',
        'unknown',
      ],
    },
    activity_name: { type: 'string', nullable: true },
    activity_type_guess: {
      type: 'string',
      enum: [
        'walking',
        'running',
        'cycling',
        'swimming',
        'strength',
        'hiit',
        'yoga',
        'hiking',
        'other',
      ],
    },
    duration_minutes: { type: 'number', nullable: true },
    calories_burned: { type: 'number', nullable: true },
    distance_m: { type: 'number', nullable: true },
    avg_hr: { type: 'number', nullable: true },
    started_at: { type: 'string', nullable: true },
    intensity_guess: {
      type: 'string',
      enum: ['low', 'moderate', 'high'],
      nullable: true,
    },
    confidence: { type: 'number' },
    image_quality: { type: 'string', enum: ['good', 'usable', 'poor'] },
    needs_user_input: { type: 'boolean' },
    fields_found: { type: 'array', items: { type: 'string' } },
    warnings: { type: 'array', items: { type: 'string' } },
  },
  required: [
    'is_activity_screen',
    'detected_app',
    'activity_type_guess',
    'confidence',
    'image_quality',
    'needs_user_input',
    'fields_found',
    'warnings',
  ],
} as const;

const ACTIVITY_SCREENSHOT_PROMPT = `Anda mengekstrak data workout dari screenshot aplikasi kebugaran/kesehatan.
Aturan ketat:
- Hanya baca angka dan teks yang TERLIHAT di layar. Jangan mengarang.
- is_activity_screen=false jika bukan ringkasan aktivitas/workout (mis. foto makanan, chat, home feed tanpa metrik).
- duration: konversi mm:ss atau jam:menit:detik ke total menit (number, boleh desimal).
- distance: konversi km/mi ke meter (distance_m). 1 mi ≈ 1609 m. 1 km = 1000 m.
- calories_burned: kalori aktif/terbakar yang ditampilkan (bukan resting bila bisa dibedakan).
- avg_hr: denyut rata-rata jika ada.
- started_at: ISO 8601 jika tanggal/jam terbaca; null jika tidak jelas.
- activity_type_guess: kategori kasar dari nama aktivitas.
- detected_app: tebak app dari UI (logo, warna, layout); unknown jika ragu.
- confidence 0-1; fields_found daftar field yang benar-benar terbaca.
- needs_user_input true jika field penting hilang atau ragu.
- Jangan diagnosis medis. Hanya JSON sesuai schema.`;

@Injectable()
export class GeminiClient {
  constructor(private readonly config: ConfigService) {}

  get promptVersion() {
    return 'food_analysis_prompt_v1';
  }

  get schemaVersion() {
    return 'food_analysis_schema_v1';
  }

  get model() {
    return this.config.get<string>('gemini.model') ?? 'gemini-3.1-flash-lite';
  }

  isConfigured() {
    return Boolean(this.config.get<string>('gemini.apiKey'));
  }

  async analyzeImage(input: {
    imageBase64?: string;
    mimeType?: string;
    imageUrl?: string;
  }): Promise<GeminiFoodResult> {
    if (!this.isConfigured()) {
      return this.mockResult();
    }
    if (!input.imageBase64 && !input.imageUrl) {
      throw new Error('no_image');
    }

    const ai = new GoogleGenAI({ apiKey: this.config.get<string>('gemini.apiKey')! });
    const parts: Array<
      | { text: string }
      | { inlineData: { mimeType: string; data: string } }
      | { fileData: { fileUri: string; mimeType: string } }
    > = [{ text: SYSTEM_PROMPT + '\nLocale: id-ID. Estimasi untuk porsi yang terlihat.' }];

    if (input.imageBase64) {
      parts.push({
        inlineData: {
          mimeType: input.mimeType ?? 'image/jpeg',
          data: input.imageBase64.replace(/^data:[^;]+;base64,/, ''),
        },
      });
    } else if (input.imageUrl) {
      parts.push({
        fileData: {
          fileUri: input.imageUrl,
          mimeType: input.mimeType ?? 'image/jpeg',
        },
      });
    }

    const maxRetries = this.config.get<number>('gemini.maxRetries') ?? 2;
    let lastErr: unknown;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model: this.model,
          contents: [{ role: 'user', parts }],
          config: {
            responseMimeType: 'application/json',
            responseSchema: FOOD_SCHEMA as unknown as Record<string, unknown>,
            temperature: 0.2,
          },
        });
        const text = response.text;
        if (!text) throw new Error('empty_response');
        return JSON.parse(text) as GeminiFoodResult;
      } catch (e) {
        lastErr = e;
        if (attempt < maxRetries) {
          await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
        }
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error('gemini_failed');
  }

  mockResult(): GeminiFoodResult {
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

  async analyzeActivityScreenshot(input: {
    imageBase64?: string;
    mimeType?: string;
    imageUrl?: string;
  }): Promise<GeminiActivityScreenshotResult> {
    if (!this.isConfigured()) {
      return this.mockActivityScreenshot();
    }
    if (!input.imageBase64 && !input.imageUrl) {
      throw new Error('no_image');
    }

    const ai = new GoogleGenAI({ apiKey: this.config.get<string>('gemini.apiKey')! });
    const parts: Array<
      | { text: string }
      | { inlineData: { mimeType: string; data: string } }
      | { fileData: { fileUri: string; mimeType: string } }
    > = [{ text: ACTIVITY_SCREENSHOT_PROMPT + '\nLocale: id-ID / en UI labels OK.' }];

    if (input.imageBase64) {
      parts.push({
        inlineData: {
          mimeType: input.mimeType ?? 'image/jpeg',
          data: input.imageBase64.replace(/^data:[^;]+;base64,/, ''),
        },
      });
    } else if (input.imageUrl) {
      parts.push({
        fileData: {
          fileUri: input.imageUrl,
          mimeType: input.mimeType ?? 'image/jpeg',
        },
      });
    }

    const maxRetries = this.config.get<number>('gemini.maxRetries') ?? 2;
    let lastErr: unknown;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model: this.model,
          contents: [{ role: 'user', parts }],
          config: {
            responseMimeType: 'application/json',
            responseSchema: ACTIVITY_SCREENSHOT_SCHEMA as unknown as Record<string, unknown>,
            temperature: 0.1,
          },
        });
        const text = response.text;
        if (!text) throw new Error('empty_response');
        return JSON.parse(text) as GeminiActivityScreenshotResult;
      } catch (e) {
        lastErr = e;
        if (attempt < maxRetries) {
          await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
        }
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error('gemini_activity_screenshot_failed');
  }

  mockActivityScreenshot(): GeminiActivityScreenshotResult {
    return {
      is_activity_screen: true,
      detected_app: 'unknown',
      activity_name: 'Lari outdoor (mock)',
      activity_type_guess: 'running',
      duration_minutes: 30,
      calories_burned: 280,
      distance_m: 4500,
      avg_hr: 148,
      started_at: new Date().toISOString(),
      intensity_guess: 'moderate',
      confidence: 0.55,
      image_quality: 'usable',
      needs_user_input: true,
      fields_found: ['duration_minutes', 'calories_burned', 'distance_m', 'avg_hr'],
      warnings: [
        'Mode mock: Gemini API key belum diset. Periksa semua angka sebelum menyimpan.',
      ],
    };
  }
}
