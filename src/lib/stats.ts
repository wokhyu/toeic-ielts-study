import { addDays, weekdayIndex } from './dates.ts';

/**
 * Wilson score interval for a proportion k/n (95% by default). Unlike k/n ± error,
 * it stays inside 0..1 and is honest with small samples: 2/2 correct is not "100%".
 */
export function wilson(k: number, n: number, z = 1.96): { p: number; low: number; high: number } {
  if (n <= 0) return { p: 0, low: 0, high: 1 };
  const p = k / n;
  const z2 = z * z;
  const centre = (p + z2 / (2 * n)) / (1 + z2 / n);
  const half = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / (1 + z2 / n);
  return { p, low: Math.max(0, centre - half), high: Math.min(1, centre + half) };
}

export interface Tally {
  n: number;
  correct: number;
}

/**
 * The weakest items with enough answers to judge: ranked by the upper end of
 * the Wilson interval, so an item is only called weak when even the optimistic
 * estimate is low. Items with fewer than `minN` answers are left out.
 */
export function weakest<T extends Tally>(items: T[], count = 3, minN = 5): T[] {
  return items
    .filter((i) => i.n >= minN)
    .map((i) => ({ i, high: wilson(i.correct, i.n).high, p: i.correct / i.n }))
    .filter((x) => x.p < 0.8)
    .sort((a, b) => a.high - b.high || b.i.n - a.i.n)
    .slice(0, count)
    .map((x) => x.i);
}

/** Activity level 0..4 for a heatmap cell. Fixed steps so colours mean the same every week. */
export function activityLevel(count: number): 0 | 1 | 2 | 3 | 4 {
  if (count <= 0) return 0;
  if (count < 5) return 1;
  if (count < 15) return 2;
  if (count < 30) return 3;
  return 4;
}

/**
 * Calendar columns (Monday to Sunday) covering at least `days` days up to `today`,
 * oldest first. Days after today are null so the last column can be partial.
 */
export function calendarWeeks(today: string, days = 126): (string | null)[][] {
  const todayIdx = weekdayIndex(today); // 0 = Monday
  const lastMonday = addDays(today, -todayIdx);
  const weeks = Math.ceil((days - (todayIdx + 1)) / 7) + 1;
  const firstMonday = addDays(lastMonday, -7 * (weeks - 1));
  return Array.from({ length: weeks }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const day = addDays(firstMonday, w * 7 + d);
      return day > today ? null : day;
    }),
  );
}

/** "45 giây", "1 phút 20 giây". */
export function formatDuration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || !Number.isFinite(ms)) return '—';
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s} giây`;
  const m = Math.floor(s / 60);
  return s % 60 ? `${m} phút ${s % 60} giây` : `${m} phút`;
}
