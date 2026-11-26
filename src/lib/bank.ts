/** Pure helpers for the question bank pages (kept free of Supabase so they are easy to test). */

export type QuestionType = 'mcq' | 'truefalse' | 'short' | 'essay';
export type AnswerKey = string | string[] | Record<string, boolean> | null;
export type Response = string | Record<string, boolean> | null;

export interface Stimulus {
  id: number;
  kind: 'passage' | 'audio';
  title: string;
  html: string;
  audio_script: string | null;
}

export interface BankQuestion {
  id: number;
  type: QuestionType;
  stem_html: string;
  topic_id: number | null;
  status: string;
  stimulus_id: number | null;
  set_id: string | null;
  tags: string[];
  options: { label: string; html: string }[];
  stimulus?: Stimulus;
}

export interface TopicRow {
  subject_id: number;
  subject_slug: string;
  subject_name: string;
  chapter_id: number;
  chapter_name: string;
  topic_id: number;
  topic_slug: string;
  topic_name: string;
  total: number;
  seen: number;
  correct: number;
}

export interface SubjectNode {
  id: number;
  name: string;
  chapters: { id: number; name: string; topics: TopicRow[] }[];
}

export function toTree(rows: TopicRow[]): SubjectNode[] {
  const subjects: SubjectNode[] = [];
  for (const r of rows) {
    let s = subjects.find((x) => x.id === r.subject_id);
    if (!s) subjects.push((s = { id: r.subject_id, name: r.subject_name, chapters: [] }));
    let c = s.chapters.find((x) => x.id === r.chapter_id);
    if (!c) s.chapters.push((c = { id: r.chapter_id, name: r.chapter_name, topics: [] }));
    c.topics.push(r);
  }
  return subjects;
}

/** Ids as returned by `returns setof int` functions. */
export function idsFrom(rows: Record<string, number>[], column: string): number[] {
  return rows.map((r) => Number(r[column]));
}

/** Whether the learner has given something to grade. */
export function hasAnswer(q: Pick<BankQuestion, 'type'>, r: Response): boolean {
  if (q.type === 'essay') return true;
  if (q.type === 'truefalse') return Boolean(r && typeof r === 'object' && Object.keys(r).length > 0);
  return typeof r === 'string' && r.trim() !== '';
}

export interface QuestionGroup<Q> {
  stimulus?: Stimulus;
  items: { q: Q; index: number }[];
}

/** Groups consecutive questions that share a passage or recording, numbering them from 1. */
export function groupByStimulus<Q extends Pick<BankQuestion, 'stimulus_id' | 'stimulus'>>(
  questions: Q[],
): QuestionGroup<Q>[] {
  const groups: QuestionGroup<Q>[] = [];
  questions.forEach((q, i) => {
    const last = groups[groups.length - 1];
    if (last && q.stimulus_id !== null && last.stimulus?.id === q.stimulus_id) {
      last.items.push({ q, index: i + 1 });
    } else {
      groups.push({
        stimulus: q.stimulus_id !== null ? q.stimulus : undefined,
        items: [{ q, index: i + 1 }],
      });
    }
  });
  return groups;
}

/** "B", "15 May / May 15", or null for keys that are not shown as text. */
export function keyText(key: AnswerKey): string | null {
  if (typeof key === 'string') return key;
  if (Array.isArray(key)) return key.join(' / ');
  return null;
}
