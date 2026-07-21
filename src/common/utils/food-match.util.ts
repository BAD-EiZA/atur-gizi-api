export type CatalogFood = {
  id?: string;
  slug?: string;
  name: string;
  aliases?: string[];
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  portionUnit?: string;
  portionAmount?: number;
  refGrams?: number | null;
};

/** Scale catalog nutrition by AI portion vs catalog reference amount. */
export function scaleCatalogToPortion(
  catalog: CatalogFood,
  aiPortionAmount: number,
): {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  scale: number;
  scaled: boolean;
} {
  const ref = Number(catalog.portionAmount) > 0 ? Number(catalog.portionAmount) : 1;
  const amt = Number(aiPortionAmount) > 0 ? Number(aiPortionAmount) : 1;
  const scale = amt / ref;
  // only scale when ratio is meaningful (not ~1 with weird units)
  const scaled = Math.abs(scale - 1) > 0.05 && scale > 0 && scale < 20;
  const s = scaled ? scale : 1;
  return {
    calories: Math.round(catalog.calories * s),
    proteinG: Math.round(catalog.proteinG * s * 10) / 10,
    carbsG: Math.round(catalog.carbsG * s * 10) / 10,
    fatG: Math.round(catalog.fatG * s * 10) / 10,
    scale: s,
    scaled,
  };
}

export function foodKey(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

function norm(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Simple token overlap score 0–1 */
export function nameSimilarity(a: string, b: string): number {
  const ta = new Set(norm(a).split(' ').filter((t) => t.length > 1));
  const tb = new Set(norm(b).split(' ').filter((t) => t.length > 1));
  if (ta.size === 0 || tb.size === 0) return norm(a) === norm(b) ? 1 : 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  return inter / Math.max(ta.size, tb.size);
}

export function matchFoodToCatalog(
  queryName: string,
  catalog: CatalogFood[],
  minScore = 0.55,
): { item: CatalogFood; score: number } | null {
  const q = norm(queryName);
  if (!q) return null;
  let best: { item: CatalogFood; score: number } | null = null;
  for (const item of catalog) {
    const names = [item.name, ...(item.aliases ?? [])];
    for (const n of names) {
      const exact = norm(n) === q;
      const score = exact ? 1 : nameSimilarity(q, n);
      // substring boost
      const nrm = norm(n);
      const sub =
        nrm.includes(q) || q.includes(nrm)
          ? Math.max(score, 0.7)
          : score;
      if (!best || sub > best.score) best = { item, score: sub };
    }
  }
  if (!best || best.score < minScore) return null;
  return best;
}
