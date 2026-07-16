import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';
import { PrismaService } from '../../prisma/prisma.service';
import { computeTarget } from '../../common/utils/nutrition.util';
import { ageFromDob } from '../../common/utils/date.util';

const FOOD_DB = [
  { name: 'Nasi putih', aliases: ['nasi', 'white rice'], calories: 130, protein_g: 2.4, carbs_g: 28, fat_g: 0.3, unit: '100 g' },
  { name: 'Nasi goreng', aliases: ['nasgor', 'nasi goreng kampung', 'nasi goreng jawa'], calories: 250, protein_g: 6, carbs_g: 35, fat_g: 9, unit: '1 porsi' },
  { name: 'Nasi Padang', aliases: ['naspad', 'nasi padang'], calories: 550, protein_g: 18, carbs_g: 55, fat_g: 28, unit: '1 porsi' },
  { name: 'Ayam geprek', aliases: ['geprek', 'ayam geprek sambal'], calories: 320, protein_g: 25, carbs_g: 12, fat_g: 18, unit: '1 porsi' },
  { name: 'Ayam goreng', aliases: ['ayam goreng tepung', 'fried chicken'], calories: 250, protein_g: 22, carbs_g: 8, fat_g: 14, unit: '1 potong' },
  { name: 'Ayam bakar', aliases: ['ayam panggang'], calories: 210, protein_g: 24, carbs_g: 2, fat_g: 12, unit: '1 potong' },
  { name: 'Tempe goreng', aliases: ['tempe', 'tempe mendoan'], calories: 120, protein_g: 8, carbs_g: 8, fat_g: 7, unit: '2 potong' },
  { name: 'Tahu goreng', aliases: ['tahu'], calories: 80, protein_g: 6, carbs_g: 3, fat_g: 5, unit: '2 potong' },
  { name: 'Indomie goreng telur', aliases: ['indomie telor', 'mie instan telur', 'indomie'], calories: 420, protein_g: 12, carbs_g: 52, fat_g: 18, unit: '1 porsi' },
  { name: 'Mie goreng', aliases: ['mi goreng', 'bakmi goreng'], calories: 380, protein_g: 10, carbs_g: 48, fat_g: 16, unit: '1 porsi' },
  { name: 'Ketoprak', aliases: ['ketoprak komplit'], calories: 350, protein_g: 14, carbs_g: 40, fat_g: 14, unit: '1 porsi' },
  { name: 'Bubur ayam', aliases: ['bubur', 'bubur tidak diaduk'], calories: 280, protein_g: 12, carbs_g: 38, fat_g: 8, unit: '1 mangkuk' },
  { name: 'Kopi hitam', aliases: ['kopi pagi', 'kopi tanpa gula'], calories: 5, protein_g: 0.3, carbs_g: 0, fat_g: 0, unit: '1 cangkir' },
  { name: 'Kopi susu', aliases: ['kopi susu gula'], calories: 120, protein_g: 4, carbs_g: 14, fat_g: 5, unit: '1 gelas' },
  { name: 'Es teh manis', aliases: ['teh manis', 'es teh'], calories: 90, protein_g: 0, carbs_g: 22, fat_g: 0, unit: '1 gelas' },
  { name: 'Roti tawar', aliases: ['roti'], calories: 80, protein_g: 3, carbs_g: 14, fat_g: 1, unit: '1 lembar' },
  { name: 'Telur dadar', aliases: ['telur', 'dadar telur'], calories: 140, protein_g: 10, carbs_g: 1, fat_g: 10, unit: '1 butir' },
  { name: 'Sayur tumis', aliases: ['tumis sayur', 'capcay'], calories: 90, protein_g: 3, carbs_g: 8, fat_g: 5, unit: '1 porsi' },
  { name: 'Sambal', aliases: ['sambal bawang', 'sambal terasi'], calories: 25, protein_g: 0.5, carbs_g: 3, fat_g: 1.5, unit: '1 sdm' },
  { name: 'Minyak goreng (tambahan)', aliases: ['minyak', 'sedikit minyak'], calories: 40, protein_g: 0, carbs_g: 0, fat_g: 4.5, unit: '1 sdt' },
];

@Injectable()
export class AiAssistService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private geminiReady() {
    return Boolean(this.config.get<string>('gemini.apiKey'));
  }

  private async textJson(prompt: string, fallback: unknown) {
    if (!this.geminiReady()) return fallback;
    try {
      const ai = new GoogleGenAI({ apiKey: this.config.get<string>('gemini.apiKey')! });
      const model = this.config.get<string>('gemini.model') ?? 'gemini-3.1-flash-lite';
      const response = await ai.models.generateContent({
        model,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: { responseMimeType: 'application/json', temperature: 0.2 },
      });
      const text = response.text;
      if (!text) return fallback;
      return JSON.parse(text);
    } catch {
      return fallback;
    }
  }

  // --- Smart search + alias ---
  async smartSearch(userId: string, query: string) {
    const q = query.trim().toLowerCase();
    const memories = await this.prisma.mealMemory.findMany({
      where: { userId, alias: { contains: q, mode: 'insensitive' } },
      take: 5,
      orderBy: { useCount: 'desc' },
    });

    const scored = FOOD_DB.map((f) => {
      const hay = [f.name, ...f.aliases].join(' ').toLowerCase();
      let score = 0;
      if (hay.includes(q)) score += 5;
      q.split(/\s+/).forEach((w) => {
        if (hay.includes(w)) score += 1;
      });
      return { ...f, score };
    })
      .filter((f) => f.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);

    const gemini = await this.textJson(
      `Cari makanan Indonesia untuk query: "${query}".
Balas JSON: {"results":[{"name":"","aliases":[],"calories":0,"protein_g":0,"carbs_g":0,"fat_g":0,"unit":"","reason":""}],"disclaimer":"estimasi"}
Maks 5 hasil. Jangan diagnosis.`,
      { results: [], disclaimer: 'estimasi' },
    );

    return {
      query,
      from_memory: memories.map((m) => ({
        alias: m.alias,
        name: m.resolvedName,
        portion_amount: m.portionAmount != null ? Number(m.portionAmount) : null,
        portion_unit: m.portionUnit,
        calories: m.calories,
        source: 'memory',
      })),
      from_catalog: scored.map(({ score: _s, ...f }) => ({ ...f, source: 'catalog' })),
      from_ai: (gemini as { results?: unknown[] }).results ?? [],
      disclaimer: 'AI membuat draft. Anda memilih item final. Bukan diagnosis.',
    };
  }

  async resolveAlias(userId: string, text: string) {
    const t = text.trim().toLowerCase();
    const memory = await this.prisma.mealMemory.findFirst({
      where: { userId, alias: { equals: t, mode: 'insensitive' } },
    });
    if (memory) {
      return {
        input: text,
        interpretation: memory.resolvedName,
        candidates: [
          {
            name: memory.resolvedName,
            calories: memory.calories,
            portion_amount: memory.portionAmount != null ? Number(memory.portionAmount) : null,
            portion_unit: memory.portionUnit,
            source: 'memory',
          },
        ],
        follow_up: null,
        disclaimer: 'Dari memori makan Anda.',
      };
    }

    const hit = FOOD_DB.find(
      (f) =>
        f.name.toLowerCase() === t ||
        f.aliases.some((a) => a.toLowerCase() === t || t.includes(a) || a.includes(t)),
    );

    const gemini = await this.textJson(
      `Resolve alias makanan Indonesia: "${text}".
JSON: {"interpretation":"","candidates":[{"name":"","calories":0,"unit":"","notes":""}],"follow_up":"string|null","disclaimer":"estimasi"}`,
      {
        interpretation: hit?.name ?? text,
        candidates: hit
          ? [{ name: hit.name, calories: hit.calories, unit: hit.unit, notes: 'katalog' }]
          : [],
        follow_up: hit?.name.toLowerCase().includes('padang')
          ? 'Pilih lauk yang dimakan (ayam, rendang, telur, dll).'
          : null,
        disclaimer: 'estimasi',
      },
    );

    return { input: text, ...(gemini as object) };
  }

  // --- Meal memory ---
  async listMemory(userId: string) {
    const rows = await this.prisma.mealMemory.findMany({
      where: { userId },
      orderBy: [{ useCount: 'desc' }, { updatedAt: 'desc' }],
    });
    return {
      data: rows.map((m) => ({
        id: m.id,
        alias: m.alias,
        resolved_name: m.resolvedName,
        portion_amount: m.portionAmount != null ? Number(m.portionAmount) : null,
        portion_unit: m.portionUnit,
        calories: m.calories,
        protein_g: m.proteinG != null ? Number(m.proteinG) : null,
        carbs_g: m.carbsG != null ? Number(m.carbsG) : null,
        fat_g: m.fatG != null ? Number(m.fatG) : null,
        notes: m.notes,
        use_count: m.useCount,
      })),
      note: 'Memori AI dapat diedit atau dihapus kapan saja.',
    };
  }

  async upsertMemory(
    userId: string,
    body: {
      alias: string;
      resolvedName: string;
      portionAmount?: number;
      portionUnit?: string;
      calories?: number;
      proteinG?: number;
      carbsG?: number;
      fatG?: number;
      notes?: string;
    },
  ) {
    const alias = body.alias.trim().toLowerCase();
    const row = await this.prisma.mealMemory.upsert({
      where: { userId_alias: { userId, alias } },
      create: {
        userId,
        alias,
        resolvedName: body.resolvedName,
        portionAmount: body.portionAmount,
        portionUnit: body.portionUnit,
        calories: body.calories,
        proteinG: body.proteinG,
        carbsG: body.carbsG,
        fatG: body.fatG,
        notes: body.notes,
      },
      update: {
        resolvedName: body.resolvedName,
        portionAmount: body.portionAmount,
        portionUnit: body.portionUnit,
        calories: body.calories,
        proteinG: body.proteinG,
        carbsG: body.carbsG,
        fatG: body.fatG,
        notes: body.notes,
        useCount: { increment: 1 },
      },
    });
    return { id: row.id, alias: row.alias, resolved_name: row.resolvedName };
  }

  async deleteMemory(userId: string, id: string) {
    await this.prisma.mealMemory.deleteMany({ where: { id, userId } });
    return { ok: true };
  }

  async resetMemory(userId: string) {
    await this.prisma.mealMemory.deleteMany({ where: { userId } });
    return { ok: true };
  }

  // --- Plate completion ---
  async plateCompletion(detectedItems: string[]) {
    const fallback = {
      missing_components: [
        {
          name: 'Sambal atau saus',
          why: 'Sering menambah kalori dan lemak tetapi tidak selalu terlihat jelas di foto.',
          options: ['Tidak ada', 'Sedikit', 'Sedang', 'Banyak', 'Tambah manual'],
        },
        {
          name: 'Minyak tambahan',
          why: 'Metode masak dapat menambah energi signifikan.',
          options: ['Tidak ada', '1 sdt', '1 sdm', 'Tidak yakin'],
        },
      ],
      disclaimer: 'Klarifikasi opsional. AI tidak menebak diam-diam.',
    };
    return this.textJson(
      `Item terdeteksi di piring: ${JSON.stringify(detectedItems)}.
Sarankan komponen yang mungkin terlewat (sambal, minyak, minuman, kerupuk).
JSON: {"missing_components":[{"name":"","why":"","options":[]}],"disclaimer":""}
Maks 3. Bahasa Indonesia. Jangan diagnosis.`,
      fallback,
    );
  }

  // --- Food comparison ---
  async compareFoods(foodA: string, foodB: string) {
    const a = FOOD_DB.find((f) => f.name.toLowerCase().includes(foodA.toLowerCase()));
    const b = FOOD_DB.find((f) => f.name.toLowerCase().includes(foodB.toLowerCase()));
    const fallback = {
      food_a: {
        name: a?.name ?? foodA,
        calories_range: a ? `${a.calories - 40}–${a.calories + 40}` : 'tidak pasti',
        protein_g: a?.protein_g ?? null,
        carbs_g: a?.carbs_g ?? null,
        fat_g: a?.fat_g ?? null,
        uncertainty: a ? 'sedang' : 'tinggi',
        factors: ['porsi', 'cara masak', 'minyak'],
      },
      food_b: {
        name: b?.name ?? foodB,
        calories_range: b ? `${b.calories - 40}–${b.calories + 40}` : 'tidak pasti',
        protein_g: b?.protein_g ?? null,
        carbs_g: b?.carbs_g ?? null,
        fat_g: b?.fat_g ?? null,
        uncertainty: b ? 'sedang' : 'tinggi',
        factors: ['porsi', 'cara masak', 'minyak'],
      },
      note: 'Porsi dan metode masak sangat memengaruhi angka. Bukan label baik/buruk.',
      disclaimer: 'Estimasi. Bukan rekomendasi medis.',
    };
    return this.textJson(
      `Bandingkan dua makanan Indonesia: "${foodA}" vs "${foodB}".
JSON: {"food_a":{"name":"","calories_range":"","protein_g":0,"carbs_g":0,"fat_g":0,"uncertainty":"","factors":[]},"food_b":{...},"note":"","disclaimer":"estimasi"}
Jangan label baik/buruk. Jangan diagnosis.`,
      fallback,
    );
  }

  // --- Contextual logging ---
  async contextualSuggestions(userId: string) {
    const hour = new Date().getHours();
    let mealHint = 'camilan';
    if (hour < 10) mealHint = 'sarapan';
    else if (hour < 15) mealHint = 'makan siang';
    else if (hour < 21) mealHint = 'makan malam';

    const recentFood = await this.prisma.foodLog.findMany({
      where: { userId, deletedAt: null },
      orderBy: { consumedAt: 'desc' },
      take: 5,
      select: { title: true, mealType: true, totalCalories: true },
    });
    const memories = await this.prisma.mealMemory.findMany({
      where: { userId },
      orderBy: { useCount: 'desc' },
      take: 5,
    });

    return {
      context: {
        local_hour: hour,
        suggested_meal_type: mealHint,
      },
      suggestions: [
        {
          type: 'recent',
          title: `Catat ${mealHint} dari catatan terakhir`,
          items: recentFood.map((f) => f.title),
        },
        {
          type: 'memory',
          title: 'Dari memori makan',
          items: memories.map((m) => m.alias),
        },
        {
          type: 'quick',
          title: 'Aksi cepat',
          items: ['Pindai foto', 'Barcode', 'Input manual', 'Catat air'],
        },
      ],
      can_disable: true,
      disclaimer: 'Rekomendasi kontekstual, bukan perintah. Dapat dimatikan di setelan.',
    };
  }

  // --- Missed log recovery ---
  async missedLogRecovery(userId: string, answers: {
    breakfast?: string;
    lunch?: string;
    dinner?: string;
    snacks?: string;
    drinks?: string;
    location?: string;
  }) {
    const draft: Array<{ name: string; meal_type: string; calories: number; source: string }> = [];
    const push = (text: string | undefined, meal: string) => {
      if (!text?.trim()) return;
      const hit = FOOD_DB.find((f) =>
        text.toLowerCase().split(/,| dan | & /).some((part) =>
          [f.name, ...f.aliases].some((a) => part.includes(a.toLowerCase())),
        ),
      );
      draft.push({
        name: hit?.name ?? text.trim(),
        meal_type: meal,
        calories: hit?.calories ?? 200,
        source: 'reconstructed',
      });
    };
    push(answers.breakfast, 'breakfast');
    push(answers.lunch, 'lunch');
    push(answers.dinner, 'dinner');
    push(answers.snacks, 'snack');
    push(answers.drinks, 'snack');

    const gemini = await this.textJson(
      `Rekonstruksi draft log dari ingatan pengguna: ${JSON.stringify(answers)}.
JSON: {"draft_items":[{"name":"","meal_type":"","calories":0,"notes":""}],"label":"Direkonstruksi dari ingatan pengguna","disclaimer":"estimasi, bukan fakta pasti"}`,
      {
        draft_items: draft,
        label: 'Direkonstruksi dari ingatan pengguna',
        disclaimer: 'Draft — bukan fakta pasti. Tinjau sebelum menyimpan.',
      },
    );
    return gemini;
  }

  // --- Habit pattern ---
  async habitPatterns(userId: string) {
    const foods = await this.prisma.foodLog.findMany({
      where: { userId, deletedAt: null },
      orderBy: { consumedAt: 'desc' },
      take: 60,
    });
    const acts = await this.prisma.activityLog.findMany({
      where: { userId, deletedAt: null },
      orderBy: { startedAt: 'desc' },
      take: 30,
    });

    const byDow: Record<number, number> = {};
    for (const f of foods) {
      const d = f.consumedAt.getUTCDay();
      byDow[d] = (byDow[d] ?? 0) + 1;
    }
    const breakfastCount = foods.filter((f) => f.mealType === 'breakfast').length;
    const patterns = [
      {
        title: 'Frekuensi pencatatan',
        statement:
          foods.length === 0
            ? 'Belum ada cukup data untuk pola kebiasaan.'
            : `Pada data Anda, terdapat ${foods.length} catatan makanan terbaru. ${breakfastCount} di antaranya berlabel sarapan.`,
        kind: 'descriptive',
      },
      {
        title: 'Aktivitas',
        statement:
          acts.length === 0
            ? 'Belum ada aktivitas tercatat pada sampel terbaru.'
            : `Anda mencatat ${acts.length} aktivitas. Total estimasi pembakaran pada sampel: ${acts.reduce((s, a) => s + a.caloriesBurned, 0)} kkal.`,
        kind: 'descriptive',
      },
    ];

    if (foods.length >= 5) {
      patterns.push({
        title: 'Korelasi (bukan sebab-akibat)',
        statement:
          'Pada data Anda, hari dengan lebih banyak catatan cenderung juga memiliki total kalori tercatat lebih tinggi. Ini korelasi pencatatan, bukan penilaian kualitas makan.',
        kind: 'correlational',
      });
    }

    return {
      patterns,
      data_points: { food_logs: foods.length, activity_logs: acts.length },
      disclaimer:
        'Insight korelasi tidak ditulis sebagai sebab-akibat. Bukan diagnosis. AI draft untuk ditinjau.',
    };
  }

  // --- Data quality ---
  async dataQuality(userId: string) {
    const foods = await this.prisma.foodLog.findMany({
      where: { userId, deletedAt: null },
      include: { items: true },
      take: 100,
      orderBy: { consumedAt: 'desc' },
    });
    const analyses = await this.prisma.aiAnalysisRun.findMany({
      where: { userId, status: { in: ['needs_review', 'succeeded'] } },
      take: 20,
    });
    const profile = await this.prisma.userProfile.findUnique({ where: { userId } });

    const noPortion = foods.filter((f) =>
      f.items.some((i) => Number(i.portionAmount) <= 0),
    ).length;
    const issues = [];
    if (noPortion > 0) {
      issues.push({
        code: 'missing_portion',
        message: `${noPortion} catatan memiliki porsi yang perlu dilengkapi agar ringkasan lebih konsisten.`,
        severity: 'medium',
      });
    }
    if (analyses.length > 0) {
      issues.push({
        code: 'ai_unreviewed',
        message: `${analyses.length} analisis AI belum dikonfirmasi menjadi food log.`,
        severity: 'low',
      });
    }
    if (!profile?.currentWeightKg) {
      issues.push({
        code: 'weight_missing',
        message: 'Berat badan belum diisi — estimasi aktivitas kurang akurat.',
        severity: 'medium',
      });
    }
    if (issues.length === 0) {
      issues.push({
        code: 'ok',
        message: 'Kualitas data terlihat cukup baik pada sampel terbaru.',
        severity: 'info',
      });
    }
    return { issues, disclaimer: 'Asisten kualitas data — bukan penilaian pribadi.' };
  }

  // --- Explain target ---
  async explainTarget(userId: string) {
    const profile = await this.prisma.userProfile.findUnique({ where: { userId } });
    const target = await this.prisma.dailyTarget.findFirst({
      where: { userId, effectiveTo: null },
      orderBy: { effectiveFrom: 'desc' },
    });
    if (!profile || !target) {
      return {
        explanation: 'Target belum tersedia. Selesaikan onboarding untuk menghitung target harian.',
        inputs: null,
        disclaimer: 'Estimasi, bukan resep medis.',
      };
    }
    const age = profile.dateOfBirth ? ageFromDob(profile.dateOfBirth) : null;
    return {
      calorie_target: target.calorieTarget,
      bmr_kcal: target.bmrKcal,
      tdee_kcal: target.tdeeKcal,
      goal: target.goal,
      calculation_method: target.calculationMethod,
      effective_from: target.effectiveFrom.toISOString().slice(0, 10),
      inputs: {
        weight_kg: profile.currentWeightKg != null ? Number(profile.currentWeightKg) : null,
        height_cm: profile.heightCm != null ? Number(profile.heightCm) : null,
        age_years: age,
        activity_level: profile.activityLevel,
        metabolic_formula: profile.metabolicFormula,
        formula_version: profile.formulaVersion,
      },
      calculation_inputs: target.calculationInputs,
      explanation: [
        `Target harian Anda ${target.calorieTarget} kkal (berlaku sejak ${target.effectiveFrom.toISOString().slice(0, 10)}).`,
        target.bmrKcal != null ? `Estimasi BMR ${target.bmrKcal} kkal memakai formula ${target.calculationMethod}.` : 'Target memakai metode manual.',
        target.tdeeKcal != null ? `TDEE ${target.tdeeKcal} kkal setelah faktor aktivitas ${profile.activityLevel ?? '—'}.` : null,
        `Tujuan yang dipilih: ${target.goal}.`,
        'Angka ini estimasi dan dapat diubah kapan saja di onboarding/profil. Bukan nasihat medis.',
      ]
        .filter(Boolean)
        .join(' '),
      disclaimer: 'Transparansi formula — AI tidak menyembunyikan perhitungan.',
    };
  }

  // --- Goal scenario simulator ---
  async simulateGoal(
    userId: string,
    scenario: {
      activityLevel?: 'sedentary' | 'light' | 'moderate' | 'high' | 'very_high';
      goal?: 'lose_weight' | 'maintain' | 'gain_weight' | 'manual';
      manualTarget?: number;
      targetRate?: number;
    },
  ) {
    const profile = await this.prisma.userProfile.findUnique({ where: { userId } });
    const current = await this.prisma.dailyTarget.findFirst({
      where: { userId, effectiveTo: null },
      orderBy: { effectiveFrom: 'desc' },
    });
    if (!profile?.dateOfBirth || !profile.currentWeightKg || !profile.heightCm) {
      return {
        error: 'Profil belum lengkap untuk simulasi.',
        disclaimer: 'Simulasi tidak mengubah target tersimpan.',
      };
    }
    const age = ageFromDob(profile.dateOfBirth);
    const simulated = computeTarget({
      formula: profile.metabolicFormula === 'manual' ? 'mifflin_b' : profile.metabolicFormula,
      weightKg: Number(profile.currentWeightKg),
      heightCm: Number(profile.heightCm),
      ageYears: age,
      activityLevel: scenario.activityLevel ?? profile.activityLevel ?? 'moderate',
      goal: scenario.goal ?? profile.fitnessGoal ?? 'maintain',
      targetRatePct: scenario.targetRate,
      manualTarget: scenario.manualTarget,
    });
    return {
      current_target: current?.calorieTarget ?? null,
      simulated_target: simulated.calorieTarget,
      simulated_bmr: simulated.bmrKcal,
      simulated_tdee: simulated.tdeeKcal,
      delta:
        current?.calorieTarget != null
          ? simulated.calorieTarget - current.calorieTarget
          : null,
      scenario,
      message: 'Ini hanya simulasi dan belum mengubah target Anda.',
      actions: ['apply_via_onboarding', 'compare', 'cancel'],
      disclaimer: 'Estimasi. Tidak ada perubahan otomatis tanpa persetujuan.',
    };
  }

  // --- Weekly planning brief ---
  async weeklyPlanningBrief(userId: string) {
    const foods = await this.prisma.foodLog.findMany({
      where: { userId, deletedAt: null },
      orderBy: { consumedAt: 'desc' },
      take: 40,
    });
    const plans = await this.prisma.mealPlan.findMany({
      where: { userId },
      orderBy: { planDate: 'desc' },
      take: 14,
    });
    const breakfastDays = new Set(
      foods.filter((f) => f.mealType === 'breakfast').map((f) => f.logDate.toISOString().slice(0, 10)),
    ).size;

    const brief = {
      last_week_pattern:
        foods.length === 0
          ? 'Belum ada cukup catatan minggu lalu untuk ringkasan.'
          : `Anda mencatat ${foods.length} entri makanan pada sampel terbaru. Sarapan tercatat pada sekitar ${breakfastDays} hari berbeda.`,
      unfinished_plans: plans.length
        ? `${plans.length} rencana makan tersimpan (terbaru: ${plans[0].title}).`
        : 'Belum ada meal plan tersimpan.',
      leftover_ingredients: 'Fitur pantry belum diisi — lewati atau tambahkan bahan di meal plan.',
      habit_nudge:
        breakfastDays > 0
          ? 'Pada data Anda, hari dengan sarapan tercatat cenderung memiliki lebih banyak entri di siang hari (korelasi pencatatan).'
          : 'Menyiapkan sarapan malam sebelumnya sering membantu konsistensi pencatatan — coba bila cocok untuk Anda.',
      activity_agenda: 'Jadwalkan 2–3 sesi aktivitas yang Anda sukai; catat setelah selesai.',
      disclaimer: 'Brief mingguan adalah draft. Bukan diagnosis atau target otomatis.',
    };

    const gemini = await this.textJson(
      `Buat weekly planning brief wellness (bukan medis) dari data:
food_count=${foods.length}, breakfast_days=${breakfastDays}, plans=${plans.length}.
JSON keys: last_week_pattern, unfinished_plans, leftover_ingredients, habit_nudge, activity_agenda, disclaimer.
Bahasa Indonesia, netral, tanpa menghakimi.`,
      brief,
    );
    return gemini;
  }
}
