import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/** Expanded Compendium-approx catalog (MET defaults at moderate effort). */
const activities = [
  // walking
  { slug: 'walking-slow', name: 'Jalan santai', category: 'cardio', defaultMet: 2.5 },
  { slug: 'walking', name: 'Berjalan', category: 'cardio', defaultMet: 3.5 },
  { slug: 'walking-brisk', name: 'Jalan cepat', category: 'cardio', defaultMet: 4.3 },
  // running
  { slug: 'running-easy', name: 'Lari pelan (~8 km/jam)', category: 'cardio', defaultMet: 8.3 },
  { slug: 'running', name: 'Lari', category: 'cardio', defaultMet: 9.8 },
  { slug: 'running-tempo', name: 'Lari tempo (~11 km/jam)', category: 'cardio', defaultMet: 11.0 },
  { slug: 'running-fast', name: 'Lari kencang (~13 km/jam)', category: 'cardio', defaultMet: 11.8 },
  // cycling
  { slug: 'cycling-leisure', name: 'Sepeda santai', category: 'cardio', defaultMet: 4.0 },
  { slug: 'cycling', name: 'Bersepeda', category: 'cardio', defaultMet: 7.5 },
  { slug: 'cycling-moderate', name: 'Sepeda sedang', category: 'cardio', defaultMet: 8.0 },
  { slug: 'cycling-vigorous', name: 'Sepeda kencang', category: 'cardio', defaultMet: 10.0 },
  // swim / hike / machine
  { slug: 'swimming-leisure', name: 'Renang santai', category: 'cardio', defaultMet: 6.0 },
  { slug: 'swimming', name: 'Berenang', category: 'cardio', defaultMet: 8.0 },
  { slug: 'swimming-laps', name: 'Renang gaya bebas', category: 'cardio', defaultMet: 9.8 },
  { slug: 'hiking', name: 'Hiking', category: 'cardio', defaultMet: 6.0 },
  { slug: 'hiking-uphill', name: 'Hiking menanjak', category: 'cardio', defaultMet: 7.8 },
  { slug: 'elliptical', name: 'Elliptical', category: 'cardio', defaultMet: 5.0 },
  { slug: 'rowing', name: 'Rowing machine', category: 'cardio', defaultMet: 7.0 },
  { slug: 'stair-climber', name: 'Stair climber', category: 'cardio', defaultMet: 9.0 },
  { slug: 'jump-rope', name: 'Lompat tali', category: 'cardio', defaultMet: 11.0 },
  { slug: 'hiit', name: 'HIIT', category: 'cardio', defaultMet: 10.0 },
  // strength
  { slug: 'strength-light', name: 'Latihan beban ringan', category: 'strength', defaultMet: 3.5 },
  { slug: 'strength', name: 'Latihan kekuatan', category: 'strength', defaultMet: 5.0 },
  { slug: 'strength-hard', name: 'Latihan beban berat', category: 'strength', defaultMet: 6.0 },
  { slug: 'bodyweight', name: 'Bodyweight / calisthenics', category: 'strength', defaultMet: 4.5 },
  // flexibility / mind
  { slug: 'yoga', name: 'Yoga', category: 'flexibility', defaultMet: 2.5 },
  { slug: 'yoga-power', name: 'Power yoga', category: 'flexibility', defaultMet: 4.0 },
  { slug: 'stretching', name: 'Stretching', category: 'flexibility', defaultMet: 2.3 },
  { slug: 'pilates', name: 'Pilates', category: 'flexibility', defaultMet: 3.0 },
  // sport / other
  { slug: 'badminton', name: 'Bulu tangkis', category: 'sport', defaultMet: 5.5 },
  { slug: 'basketball', name: 'Basket', category: 'sport', defaultMet: 6.5 },
  { slug: 'soccer', name: 'Sepak bola', category: 'sport', defaultMet: 7.0 },
  { slug: 'tennis', name: 'Tenis', category: 'sport', defaultMet: 7.3 },
  { slug: 'dance', name: 'Dansa / aerobik', category: 'sport', defaultMet: 5.0 },
  { slug: 'martial-arts', name: 'Bela diri', category: 'sport', defaultMet: 10.0 },
  { slug: 'other', name: 'Olahraga lain', category: 'other', defaultMet: 4.0 },
];

/** Core Indonesian meals for AI match + search (portion defaults). */
const foods: Array<{
  slug: string;
  name: string;
  aliases: string[];
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  portionUnit: string;
}> = [
  { slug: 'nasi-putih', name: 'Nasi putih', aliases: ['nasi', 'white rice'], calories: 175, proteinG: 3.2, carbsG: 40, fatG: 0.3, portionUnit: 'centong' },
  { slug: 'nasi-goreng', name: 'Nasi goreng', aliases: ['nasgor'], calories: 350, proteinG: 8, carbsG: 48, fatG: 12, portionUnit: 'porsi' },
  { slug: 'nasi-padang', name: 'Nasi Padang', aliases: ['naspad'], calories: 650, proteinG: 22, carbsG: 60, fatG: 32, portionUnit: 'porsi' },
  { slug: 'ayam-geprek', name: 'Ayam geprek', aliases: ['geprek'], calories: 420, proteinG: 28, carbsG: 18, fatG: 24, portionUnit: 'porsi' },
  { slug: 'ayam-goreng', name: 'Ayam goreng', aliases: ['fried chicken'], calories: 280, proteinG: 24, carbsG: 8, fatG: 16, portionUnit: 'potong' },
  { slug: 'ayam-bakar', name: 'Ayam bakar', aliases: ['ayam panggang'], calories: 230, proteinG: 26, carbsG: 2, fatG: 12, portionUnit: 'potong' },
  { slug: 'tempe-goreng', name: 'Tempe goreng', aliases: ['tempe'], calories: 140, proteinG: 9, carbsG: 10, fatG: 8, portionUnit: '2 potong' },
  { slug: 'tahu-goreng', name: 'Tahu goreng', aliases: ['tahu'], calories: 100, proteinG: 7, carbsG: 4, fatG: 6, portionUnit: '2 potong' },
  { slug: 'telur-dadar', name: 'Telur dadar', aliases: ['dadar telur', 'telur'], calories: 160, proteinG: 11, carbsG: 1, fatG: 12, portionUnit: 'butir' },
  { slug: 'indomie-telur', name: 'Indomie goreng telur', aliases: ['indomie', 'mie instan'], calories: 480, proteinG: 14, carbsG: 55, fatG: 22, portionUnit: 'porsi' },
  { slug: 'mie-goreng', name: 'Mie goreng', aliases: ['bakmi goreng'], calories: 420, proteinG: 12, carbsG: 52, fatG: 18, portionUnit: 'porsi' },
  { slug: 'soto-ayam', name: 'Soto ayam', aliases: ['soto'], calories: 280, proteinG: 18, carbsG: 22, fatG: 12, portionUnit: 'mangkuk' },
  { slug: 'rawon', name: 'Rawon', aliases: [], calories: 320, proteinG: 20, carbsG: 18, fatG: 16, portionUnit: 'mangkuk' },
  { slug: 'gado-gado', name: 'Gado-gado', aliases: ['gadogado'], calories: 350, proteinG: 14, carbsG: 28, fatG: 18, portionUnit: 'porsi' },
  { slug: 'ketoprak', name: 'Ketoprak', aliases: [], calories: 360, proteinG: 14, carbsG: 42, fatG: 14, portionUnit: 'porsi' },
  { slug: 'bubur-ayam', name: 'Bubur ayam', aliases: ['bubur'], calories: 300, proteinG: 14, carbsG: 40, fatG: 8, portionUnit: 'mangkuk' },
  { slug: 'bakso', name: 'Bakso', aliases: ['baso'], calories: 320, proteinG: 18, carbsG: 30, fatG: 12, portionUnit: 'mangkuk' },
  { slug: 'sate-ayam', name: 'Sate ayam', aliases: ['sate'], calories: 280, proteinG: 24, carbsG: 12, fatG: 14, portionUnit: '10 tusuk' },
  { slug: 'rendang', name: 'Rendang daging', aliases: ['rendang'], calories: 350, proteinG: 28, carbsG: 8, fatG: 22, portionUnit: 'porsi' },
  { slug: 'sayur-asem', name: 'Sayur asem', aliases: [], calories: 80, proteinG: 3, carbsG: 12, fatG: 2, portionUnit: 'mangkuk' },
  { slug: 'sayur-tumis', name: 'Sayur tumis', aliases: ['capcay', 'tumis sayur'], calories: 110, proteinG: 4, carbsG: 10, fatG: 6, portionUnit: 'porsi' },
  { slug: 'pecel', name: 'Pecel', aliases: [], calories: 280, proteinG: 10, carbsG: 32, fatG: 12, portionUnit: 'porsi' },
  { slug: 'lontong-sayur', name: 'Lontong sayur', aliases: ['lontong'], calories: 380, proteinG: 12, carbsG: 48, fatG: 14, portionUnit: 'porsi' },
  { slug: 'nasi-uduk', name: 'Nasi uduk', aliases: [], calories: 320, proteinG: 6, carbsG: 42, fatG: 12, portionUnit: 'porsi' },
  { slug: 'nasi-kuning', name: 'Nasi kuning', aliases: [], calories: 300, proteinG: 6, carbsG: 45, fatG: 8, portionUnit: 'porsi' },
  { slug: 'pisang-goreng', name: 'Pisang goreng', aliases: [], calories: 180, proteinG: 1.5, carbsG: 28, fatG: 7, portionUnit: '2 potong' },
  { slug: 'roti-bakar', name: 'Roti bakar', aliases: ['roti'], calories: 220, proteinG: 6, carbsG: 32, fatG: 8, portionUnit: 'porsi' },
  { slug: 'kopi-hitam', name: 'Kopi hitam', aliases: ['kopi'], calories: 5, proteinG: 0.3, carbsG: 0, fatG: 0, portionUnit: 'cangkir' },
  { slug: 'kopi-susu', name: 'Kopi susu', aliases: [], calories: 120, proteinG: 4, carbsG: 14, fatG: 5, portionUnit: 'gelas' },
  { slug: 'es-teh-manis', name: 'Es teh manis', aliases: ['teh manis', 'es teh'], calories: 90, proteinG: 0, carbsG: 22, fatG: 0, portionUnit: 'gelas' },
  { slug: 'jus-alpukat', name: 'Jus alpukat', aliases: ['alpukat'], calories: 280, proteinG: 3, carbsG: 28, fatG: 18, portionUnit: 'gelas' },
  { slug: 'smoothie-pisang', name: 'Smoothie pisang', aliases: [], calories: 200, proteinG: 5, carbsG: 38, fatG: 3, portionUnit: 'gelas' },
  { slug: 'oatmeal', name: 'Oatmeal', aliases: ['oat'], calories: 180, proteinG: 6, carbsG: 30, fatG: 4, portionUnit: 'mangkuk' },
  { slug: 'salad-sayur', name: 'Salad sayur', aliases: ['salad'], calories: 120, proteinG: 4, carbsG: 12, fatG: 6, portionUnit: 'porsi' },
  { slug: 'ikan-bakar', name: 'Ikan bakar', aliases: [], calories: 200, proteinG: 28, carbsG: 0, fatG: 8, portionUnit: 'porsi' },
  { slug: 'ikan-goreng', name: 'Ikan goreng', aliases: [], calories: 260, proteinG: 24, carbsG: 6, fatG: 14, portionUnit: 'porsi' },
  { slug: 'udang-goreng', name: 'Udang goreng tepung', aliases: ['udang'], calories: 240, proteinG: 18, carbsG: 14, fatG: 12, portionUnit: 'porsi' },
  { slug: 'sop-buntut', name: 'Sop buntut', aliases: [], calories: 380, proteinG: 26, carbsG: 16, fatG: 22, portionUnit: 'mangkuk' },
  { slug: 'martabak-telur', name: 'Martabak telur', aliases: ['martabak'], calories: 350, proteinG: 14, carbsG: 28, fatG: 20, portionUnit: 'potong' },
  { slug: 'pempek', name: 'Pempek', aliases: [], calories: 280, proteinG: 12, carbsG: 36, fatG: 8, portionUnit: 'porsi' },
];

async function main() {
  for (const a of activities) {
    await prisma.activityType.upsert({
      where: { slug: a.slug },
      update: {
        name: a.name,
        category: a.category,
        defaultMet: a.defaultMet,
        active: true,
        sourceVersion: 'met_compendium_approx_v2',
      },
      create: { ...a, sourceVersion: 'met_compendium_approx_v2' },
    });
  }

  for (const f of foods) {
    await prisma.foodReference.upsert({
      where: { slug: f.slug },
      update: {
        name: f.name,
        aliases: f.aliases,
        calories: f.calories,
        proteinG: f.proteinG,
        carbsG: f.carbsG,
        fatG: f.fatG,
        portionUnit: f.portionUnit,
        active: true,
      },
      create: {
        slug: f.slug,
        name: f.name,
        aliases: f.aliases,
        calories: f.calories,
        proteinG: f.proteinG,
        carbsG: f.carbsG,
        fatG: f.fatG,
        portionUnit: f.portionUnit,
        source: 'catalog_id',
      },
    });
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
