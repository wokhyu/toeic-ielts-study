/** Dates are handled as YYYY-MM-DD strings in Vietnam time. */
export const TIME_ZONE = 'Asia/Ho_Chi_Minh';

export function todayVN(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE }).format(now);
}

export function toDateVN(iso: string): string {
  return todayVN(new Date(iso));
}

export function daysBetween(from: string, to: string): number {
  const a = Date.UTC(+from.slice(0, 4), +from.slice(5, 7) - 1, +from.slice(8, 10));
  const b = Date.UTC(+to.slice(0, 4), +to.slice(5, 7) - 1, +to.slice(8, 10));
  return Math.round((b - a) / 86_400_000);
}

/** 0 = Monday ... 6 = Sunday */
export function weekdayIndex(date: string): number {
  const d = new Date(`${date}T00:00:00Z`).getUTCDay();
  return (d + 6) % 7;
}

/** The given date if it is a Monday, otherwise the next Monday. */
export function nextMonday(date: string): string {
  const idx = weekdayIndex(date);
  if (idx === 0) return date;
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + (7 - idx));
  return d.toISOString().slice(0, 10);
}

export function formatDateVN(date: string): string {
  const [y, m, d] = date.split('-');
  return `${d}/${m}/${y}`;
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
