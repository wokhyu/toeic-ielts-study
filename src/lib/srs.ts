import { addDays } from './dates.ts';

/**
 * Simplified SM-2 spaced repetition, with the four Anki-style buttons.
 */
export type Rating = 'again' | 'hard' | 'good' | 'easy';

export interface CardState {
  ease: number;
  interval_days: number;
  reps: number;
  due_date: string; // YYYY-MM-DD
}

const QUALITY: Record<Rating, number> = { again: 1, hard: 3, good: 4, easy: 5 };
export const MIN_EASE = 1.3;

export function newCard(today: string): CardState {
  return { ease: 2.5, interval_days: 0, reps: 0, due_date: today };
}

export function review(prev: CardState, rating: Rating, today: string): CardState {
  const q = QUALITY[rating];
  const ease = Math.max(MIN_EASE, prev.ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));

  if (q < 3) {
    // Forgotten: start over, see it again tomorrow.
    return { ease, interval_days: 1, reps: 0, due_date: addDays(today, 1) };
  }

  const reps = prev.reps + 1;
  let interval: number;
  if (reps === 1) interval = rating === 'easy' ? 3 : 1;
  else if (reps === 2) interval = rating === 'hard' ? 3 : 6;
  else
    interval = Math.round(
      prev.interval_days * (rating === 'hard' ? 1.2 : ease) * (rating === 'easy' ? 1.3 : 1),
    );
  interval = Math.max(1, interval);
  return {
    ease: Math.round(ease * 100) / 100,
    interval_days: interval,
    reps,
    due_date: addDays(today, interval),
  };
}

export function isDue(card: Pick<CardState, 'due_date'> | undefined, today: string): boolean {
  return !card || card.due_date <= today;
}
