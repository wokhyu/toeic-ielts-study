import type { PlacementQuestion, Program, Scoring, Track } from '../content/schema.ts';

export type Answers = Record<string, string | undefined>;

export function countCorrect(questions: PlacementQuestion[], answers: Answers): number {
  return questions.reduce((n, q) => (answers[q.id] === q.answer ? n + 1 : n), 0);
}

export function trackFromCorrect(scoring: Scoring, program: Program, correct: number): Track {
  const hit = scoring[program].thresholds.find((t) => correct >= t.min && correct <= t.max);
  if (!hit) throw new Error(`No ${program} threshold covers ${correct} correct answers`);
  return hit.track;
}

/** Real exam score (TOEIC 10-990 or IELTS band 0-9) to a track. */
export function trackFromRealScore(scoring: Scoring, program: Program, score: number): Track {
  const ranges = scoring[program].real_score;
  const hit = ranges.find((r) => score >= r.min && score <= r.max);
  if (hit) return hit.track;
  // IELTS bands between ranges (e.g. 4.25) fall back to the lower track.
  const below = [...ranges].reverse().find((r) => score > r.max);
  return below?.track ?? ranges[0].track;
}

const ORDER: Track[] = ['A', 'B', 'C'];

/**
 * IELTS: if the learner rates both Writing and Speaking below the track from the
 * objective sections, place them one track lower (see scoring.json note).
 */
export function adjustForProductive(objective: Track, writing: Track, speaking: Track): Track {
  const o = ORDER.indexOf(objective);
  if (ORDER.indexOf(writing) < o && ORDER.indexOf(speaking) < o) return ORDER[o - 1];
  return objective;
}

export function isValidRealScore(program: Program, score: number): boolean {
  if (!Number.isFinite(score)) return false;
  if (program === 'toeic') return score >= 10 && score <= 990 && score % 5 === 0;
  return score >= 0 && score <= 9 && (score * 2) % 1 === 0;
}
