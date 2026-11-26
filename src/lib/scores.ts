import { scoring } from '../content/index.ts';

/** IELTS overall: mean of the four bands rounded to the nearest half band (.25 and .75 round up). */
export function ieltsOverall(bands: number[]): number {
  const mean = bands.reduce((s, b) => s + b, 0) / bands.length;
  return Math.floor(mean * 2 + 0.5) / 2;
}

/** on-tap-11 scores are stored x100 per question; school reports use a mark out of ten. */
export function toTen(score: number, maxScore: number): number {
  if (!maxScore) return 0;
  return Math.round((score / maxScore) * 100) / 10;
}

/** The track's target score as a number ("850+" → 850, "7.0+" → 7), or null without a track. */
export function targetScore(program: 'toeic' | 'ielts', track: string | null): number | null {
  if (!track) return null;
  const t = scoring[program].thresholds.find((x) => x.track === track);
  const n = t ? Number.parseFloat(t.target) : Number.NaN;
  return Number.isFinite(n) ? n : null;
}
