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
