import { describe, expect, it } from 'vitest';
import { placementTests, roadmaps, scoring } from '../content/index.ts';
import { addDays, daysBetween, nextMonday, todayVN, weekdayIndex } from './dates.ts';
import {
  adjustForProductive,
  countCorrect,
  isValidRealScore,
  trackFromCorrect,
  trackFromRealScore,
} from './placement.ts';
import { allTasks, minutesOf, positionOn, tasksFor, weekCompletion } from './roadmap.ts';
import { ieltsOverall, toTen } from './scores.ts';
import { newCard, review } from './srs.ts';
import { currentStreak, percent } from './streak.ts';

describe('dates', () => {
  it('uses Vietnam time for today', () => {
    expect(todayVN(new Date('2026-11-10T18:30:00Z'))).toBe('2026-11-11');
  });

  it('finds weekdays and the next Monday', () => {
    expect(weekdayIndex('2026-11-16')).toBe(0); // Monday
    expect(weekdayIndex('2026-11-15')).toBe(6); // Sunday
    expect(nextMonday('2026-11-11')).toBe('2026-11-16');
    expect(nextMonday('2026-11-16')).toBe('2026-11-16');
    expect(daysBetween('2026-11-16', '2026-11-23')).toBe(7);
  });
});

describe('placement', () => {
  it('scores a test and maps the score to a track', () => {
    const qs = placementTests.toeic;
    const allRight = Object.fromEntries(qs.map((q) => [q.id, q.answer]));
    expect(countCorrect(qs, allRight)).toBe(50);
    expect(countCorrect(qs, {})).toBe(0);
    expect(trackFromCorrect(scoring, 'toeic', 0)).toBe('A');
    expect(trackFromCorrect(scoring, 'toeic', 30)).toBe('B');
    expect(trackFromCorrect(scoring, 'toeic', 50)).toBe('C');
    expect(trackFromCorrect(scoring, 'ielts', 17)).toBe('C');
  });

  it('maps real exam scores to a track', () => {
    expect(trackFromRealScore(scoring, 'toeic', 395)).toBe('A');
    expect(trackFromRealScore(scoring, 'toeic', 600)).toBe('B');
    expect(trackFromRealScore(scoring, 'toeic', 605)).toBe('C');
    expect(trackFromRealScore(scoring, 'ielts', 5.5)).toBe('B');
    expect(trackFromRealScore(scoring, 'ielts', 4.25)).toBe('A');
    expect(isValidRealScore('toeic', 452)).toBe(false);
    expect(isValidRealScore('ielts', 6.5)).toBe(true);
  });

  it('drops an IELTS learner one track only when both writing and speaking are lower', () => {
    expect(adjustForProductive('C', 'B', 'A')).toBe('B');
    expect(adjustForProductive('C', 'C', 'A')).toBe('C');
    expect(adjustForProductive('A', 'A', 'A')).toBe('A');
  });
});

describe('roadmap', () => {
  it('locates the study day from the start Monday', () => {
    expect(positionOn('2026-11-16', '2026-11-15').status).toBe('not_started');
    expect(positionOn('2026-11-16', '2026-11-16')).toEqual({ week: 1, day: 1, status: 'in_progress' });
    expect(positionOn('2026-11-16', '2026-11-29')).toEqual({ week: 2, day: 7, status: 'in_progress' });
    expect(positionOn('2026-11-16', addDays('2026-11-16', 84)).status).toBe('finished');
  });

  it('gives each track its own tasks within the daily budget', () => {
    const week = roadmaps.toeic[0];
    const a = tasksFor(week, 1, 'A');
    expect(a.some((t) => t.track === 'B')).toBe(false);
    expect(minutesOf(a)).toBeGreaterThanOrEqual(120);
    expect(tasksFor(week, 7, 'A')).toEqual([]);
    const done = new Set([a[0].id]);
    expect(weekCompletion(week, 'A', done).done).toBe(1);
    expect(allTasks(roadmaps.ielts, 'C').length).toBeGreaterThan(200);
  });
});

describe('srs', () => {
  it('grows the interval on success and resets on failure', () => {
    let c = newCard('2026-11-11');
    c = review(c, 'good', '2026-11-11');
    expect(c).toMatchObject({ reps: 1, interval_days: 1, due_date: '2026-11-12' });
    c = review(c, 'good', '2026-11-12');
    expect(c).toMatchObject({ reps: 2, interval_days: 6, due_date: '2026-11-18' });
    c = review(c, 'good', '2026-11-18');
    expect(c.interval_days).toBe(15);
    const lapsed = review(c, 'again', '2026-12-03');
    expect(lapsed).toMatchObject({ reps: 0, interval_days: 1, due_date: '2026-12-04' });
    expect(lapsed.ease).toBeLessThan(c.ease);
    expect(review(newCard('2026-11-11'), 'easy', '2026-11-11').interval_days).toBe(3);
  });
});

describe('streak', () => {
  it('counts consecutive days ending today or yesterday', () => {
    expect(currentStreak([], '2026-11-11')).toBe(0);
    expect(currentStreak(['2026-11-11', '2026-11-10', '2026-11-10', '2026-11-08'], '2026-11-11')).toBe(2);
    expect(currentStreak(['2026-11-10', '2026-11-09'], '2026-11-11')).toBe(2);
    expect(currentStreak(['2026-11-08'], '2026-11-11')).toBe(0);
    expect(percent(1, 3)).toBe(33);
    expect(percent(1, 0)).toBe(0);
  });
});

describe('scores', () => {
  it('rounds the IELTS overall band like the official rule', () => {
    expect(ieltsOverall([6.5, 6.5, 5, 7])).toBe(6.5); // 6.25 -> 6.5
    expect(ieltsOverall([6, 6, 6, 6.5])).toBe(6); // 6.125 -> 6
    expect(ieltsOverall([7, 7, 6.5, 7])).toBe(7); // 6.875 -> 7
  });

  it('converts on-tap-11 scores to a mark out of ten', () => {
    expect(toTen(850, 1000)).toBe(8.5);
    expect(toTen(0, 0)).toBe(0);
  });
});
