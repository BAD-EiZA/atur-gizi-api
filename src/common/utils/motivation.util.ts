export function motivationalMessage(input: {
  foodLogCount: number;
  progressPct: number;
  hasActivity: boolean;
}): string {
  if (input.foodLogCount === 0) {
    return 'Mulai catat makanan pertama hari ini — langkah kecil sudah cukup.';
  }
  if (input.progressPct < 50) {
    return 'Konsisten mencatat membantu Anda memahami pola harian.';
  }
  if (input.progressPct < 90) {
    return 'Anda mendekati target harian. Lanjutkan dengan nyaman.';
  }
  if (input.progressPct <= 110) {
    return 'Target harian tercapai. Bagus.';
  }
  const base = 'Target harian terlampaui. Tidak apa-apa — sesuaikan bila perlu.';
  if (input.hasActivity) {
    return `${base} Aktivitas hari ini sudah tercatat.`;
  }
  return base;
}
