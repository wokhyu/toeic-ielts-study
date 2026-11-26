import { describe, expect, it } from 'vitest';
import { activityLevel, calendarWeeks, formatDuration, weakest, wilson } from './stats.ts';

describe('wilson', () => {
  it('matches the textbook interval', () => {
    const w = wilson(8, 10);
    expect(w.p).toBe(0.8);
    expect(w.low).toBeCloseTo(0.49, 2);
    expect(w.high).toBeCloseTo(0.943, 2);
  });

  it('stays inside 0..1 and is wide for tiny samples', () => {
    expect(wilson(2, 2).low).toBeLessThan(0.5);
    expect(wilson(2, 2).high).toBe(1);
    expect(wilson(0, 3).low).toBe(0);
    expect(wilson(0, 0)).toEqual({ p: 0, low: 0, high: 1 });
  });
});

describe('weakest', () => {
  const items = [
    { tag: 'passive', n: 20, correct: 8 },
    { tag: 'tense', n: 3, correct: 0 }, // too few answers to judge
    { tag: 'vocab', n: 40, correct: 36 }, // strong
    { tag: 'relative', n: 6, correct: 3 },
    { tag: 'prep', n: 30, correct: 15 },
  ];

  it('skips thin data and strong items, weakest first by the optimistic estimate', () => {
    expect(weakest(items).map((i) => i.tag)).toEqual(['passive', 'prep', 'relative']);
    expect(weakest(items, 1).map((i) => i.tag)).toEqual(['passive']);
  });
});

describe('heatmap helpers', () => {
  it('buckets activity into fixed levels', () => {
    expect([0, 1, 4, 5, 14, 15, 29, 30, 99].map(activityLevel)).toEqual([0, 1, 1, 2, 2, 3, 3, 4, 4]);
  });

  it('builds Monday-first weeks ending today', () => {
    const weeks = calendarWeeks('2026-11-26', 14); // a Thursday
    expect(weeks.at(-1)).toEqual(['2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26', null, null, null]);
    expect(weeks[0][0]).toBe('2026-11-09');
    expect(weeks.flat().filter(Boolean).length).toBeGreaterThanOrEqual(14);
  });
});

describe('formatDuration', () => {
  it('reads naturally in Vietnamese', () => {
    expect(formatDuration(45_000)).toBe('45 giây');
    expect(formatDuration(80_000)).toBe('1 phút 20 giây');
    expect(formatDuration(120_000)).toBe('2 phút');
    expect(formatDuration(null)).toBe('—');
  });
});
