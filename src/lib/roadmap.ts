import type { Task, Track, Week } from '../content/schema.ts';
import { daysBetween } from './dates.ts';

export interface StudyPosition {
  week: number; // 1..12
  day: number; // 1..7, 7 = Sunday (rest)
  status: 'not_started' | 'in_progress' | 'finished';
}

/** Where the learner is in the 12-week plan, given the Monday they started. */
export function positionOn(startDate: string, today: string): StudyPosition {
  const diff = daysBetween(startDate, today);
  if (diff < 0) return { week: 1, day: 1, status: 'not_started' };
  if (diff >= 12 * 7) return { week: 12, day: 7, status: 'finished' };
  return { week: Math.floor(diff / 7) + 1, day: (diff % 7) + 1, status: 'in_progress' };
}

export function tasksFor(week: Week, day: number, track: Track): Task[] {
  const d = week.days.find((x) => x.day === day);
  return d ? d.tasks.filter((t) => t.track === 'all' || t.track === track) : [];
}

export function minutesOf(tasks: Task[]): number {
  return tasks.reduce((s, t) => s + t.minutes, 0);
}

export function allTasks(weeks: Week[], track: Track): Task[] {
  return weeks.flatMap((w) =>
    w.days.flatMap((d) => d.tasks.filter((t) => t.track === 'all' || t.track === track)),
  );
}

export function weekCompletion(week: Week, track: Track, done: Set<string>): { done: number; total: number } {
  const tasks = week.days.flatMap((d) => tasksFor(week, d.day, track));
  return { done: tasks.filter((t) => done.has(t.id)).length, total: tasks.length };
}
