import { daysBetween } from './dates.ts';

/**
 * Consecutive study days ending today or yesterday (same rule as get_leaderboard in SQL).
 * `days` are YYYY-MM-DD strings in Vietnam time, in any order, duplicates allowed.
 */
export function currentStreak(days: string[], today: string): number {
  const unique = [...new Set(days)].sort().reverse();
  if (unique.length === 0 || daysBetween(unique[0], today) > 1) return 0;
  let streak = 1;
  for (let i = 1; i < unique.length; i++) {
    if (daysBetween(unique[i], unique[i - 1]) !== 1) break;
    streak += 1;
  }
  return streak;
}

export function percent(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}
