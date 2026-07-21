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
};

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
