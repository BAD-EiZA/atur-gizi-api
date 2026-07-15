/** Local calendar date YYYY-MM-DD in IANA timezone */
export function localDateString(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function parseDateOnly(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error('invalid_date');
  }
  return new Date(`${value}T00:00:00.000Z`);
}

export function ageFromDob(dob: Date, now = new Date()): number {
  const y = now.getUTCFullYear() - dob.getUTCFullYear();
  const m = now.getUTCMonth() - dob.getUTCMonth();
  const d = now.getUTCDate() - dob.getUTCDate();
  if (m < 0 || (m === 0 && d < 0)) return y - 1;
  return y;
}

export function roundToNearest10(n: number): number {
  return Math.round(n / 10) * 10;
}
