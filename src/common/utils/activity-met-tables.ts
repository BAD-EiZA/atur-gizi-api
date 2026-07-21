/**
 * Approximate Compendium of Physical Activities MET bands by speed (km/h).
 * sourceVersion: met_compendium_approx_v1
 */

export type PaceFamily = 'walking' | 'running' | 'cycling';

const WALKING: Array<{ maxKmh: number; met: number }> = [
  { maxKmh: 3.2, met: 2.0 },
  { maxKmh: 4.0, met: 2.8 },
  { maxKmh: 4.8, met: 3.5 },
  { maxKmh: 5.6, met: 4.3 },
  { maxKmh: 6.4, met: 5.0 },
  { maxKmh: 99, met: 6.3 },
];

const RUNNING: Array<{ maxKmh: number; met: number }> = [
  { maxKmh: 8.0, met: 8.3 },
  { maxKmh: 9.7, met: 9.8 },
  { maxKmh: 11.3, met: 11.0 },
  { maxKmh: 12.9, met: 11.8 },
  { maxKmh: 14.5, met: 12.8 },
  { maxKmh: 16.1, met: 14.5 },
  { maxKmh: 99, met: 16.0 },
];

const CYCLING: Array<{ maxKmh: number; met: number }> = [
  { maxKmh: 16, met: 4.0 },
  { maxKmh: 19, met: 6.8 },
  { maxKmh: 22, met: 8.0 },
  { maxKmh: 26, met: 10.0 },
  { maxKmh: 30, met: 12.0 },
  { maxKmh: 99, met: 14.0 },
];

const FAMILY_BY_SLUG: Record<string, PaceFamily> = {
  walking: 'walking',
  'walking-slow': 'walking',
  'walking-brisk': 'walking',
  running: 'running',
  'running-easy': 'running',
  'running-tempo': 'running',
  'running-fast': 'running',
  cycling: 'cycling',
  'cycling-leisure': 'cycling',
  'cycling-moderate': 'cycling',
  'cycling-vigorous': 'cycling',
};

export function paceFamilyFromSlug(slug?: string | null): PaceFamily | null {
  if (!slug) return null;
  if (FAMILY_BY_SLUG[slug]) return FAMILY_BY_SLUG[slug];
  if (slug.startsWith('walk')) return 'walking';
  if (slug.startsWith('run')) return 'running';
  if (slug.startsWith('cycl') || slug.startsWith('bike')) return 'cycling';
  return null;
}

export function metFromSpeedKmh(family: PaceFamily, speedKmh: number): number {
  const table = family === 'walking' ? WALKING : family === 'running' ? RUNNING : CYCLING;
  const s = Math.max(0, speedKmh);
  for (const row of table) {
    if (s <= row.maxKmh) return row.met;
  }
  return table[table.length - 1]!.met;
}

/** distance meters + duration minutes → km/h */
export function speedKmhFromDistance(distanceM: number, durationMinutes: number): number | null {
  if (!(distanceM > 0) || !(durationMinutes > 0)) return null;
  const hours = durationMinutes / 60;
  return distanceM / 1000 / hours;
}
