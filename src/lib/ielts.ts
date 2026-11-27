/** Words in a text, counted like the database does (runs of non-space characters). */
export function wordCount(text: string): number {
  const t = text.trim();
  return t === '' ? 0 : t.split(/\s+/).length;
}

/** IELTS rounding of a mean band to the nearest half band (x.25 up to x.5, x.75 up to x+1). */
export function ieltsRound(value: number): number {
  return Math.floor(value * 2 + 0.5) / 2;
}

/** "6.5" style band text. */
export function formatBand(value: number | null | undefined): string {
  return value === null || value === undefined ? '—' : Number(value).toFixed(1);
}

/** "m:ss" for a number of seconds. */
export function clock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
