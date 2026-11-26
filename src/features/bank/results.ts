import type { CourseId } from '../../lib/types.ts';
import { toTen } from '../../lib/scores.ts';
import type { MockSection } from './data.ts';

export interface AttemptSummary {
  id: number;
  mode: 'exam' | 'mock';
  submitted_at: string | null;
  score: number | null;
  max_score: number | null;
  config: { sections?: Record<string, MockSection>; total?: number } | null;
  /** Roadmap task the exam was started from ("Làm ngay"). */
  task_id?: string | null;
  mock_test_id?: string | null;
}

/** "695", "Band 6.5", "7.5/10" or "12/20 câu" depending on the course and kind of attempt. */
export function attemptScore(
  course: CourseId,
  a: Pick<AttemptSummary, 'mode' | 'score' | 'max_score' | 'config'>,
): string {
  if (a.mode === 'mock' && a.config?.total !== undefined) {
    return course === 'ielts' ? `Band ${Number(a.config.total).toFixed(1)}` : `${a.config.total} điểm`;
  }
  if (course === 'on-tap-11') return `${toTen(a.score ?? 0, a.max_score ?? 0)}/10`;
  return `${Math.round((a.score ?? 0) / 100)}/${Math.round((a.max_score ?? 0) / 100)} câu`;
}
