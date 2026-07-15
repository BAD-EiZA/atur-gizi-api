import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const activities = [
  { slug: 'walking', name: 'Berjalan', category: 'cardio', defaultMet: 3.5 },
  { slug: 'running', name: 'Lari', category: 'cardio', defaultMet: 9.8 },
  { slug: 'cycling', name: 'Bersepeda', category: 'cardio', defaultMet: 7.5 },
  { slug: 'yoga', name: 'Yoga', category: 'flexibility', defaultMet: 2.5 },
  { slug: 'strength', name: 'Latihan kekuatan', category: 'strength', defaultMet: 5.0 },
  { slug: 'swimming', name: 'Berenang', category: 'cardio', defaultMet: 8.0 },
  { slug: 'hiking', name: 'Hiking', category: 'cardio', defaultMet: 6.0 },
  { slug: 'hiit', name: 'HIIT', category: 'cardio', defaultMet: 10.0 },
  { slug: 'elliptical', name: 'Elliptical', category: 'cardio', defaultMet: 5.0 },
  { slug: 'other', name: 'Olahraga lain', category: 'other', defaultMet: 4.0 },
];

async function main() {
  for (const a of activities) {
    await prisma.activityType.upsert({
      where: { slug: a.slug },
      update: { name: a.name, category: a.category, defaultMet: a.defaultMet, active: true },
      create: a,
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
