import { db } from '../../lib/supabase.ts';
import { unwrap } from '../../lib/useAsync.ts';

export type QuestionType = 'mcq' | 'truefalse' | 'short' | 'essay';
export type AnswerKey = string | Record<string, boolean> | null;
export type Response = string | Record<string, boolean> | null;

export interface OtQuestion {
  id: number;
  type: QuestionType;
  stem_html: string;
  topic_id: number | null;
  status: string;
  options: { label: string; html: string }[];
}

export interface Reveal {
  answer_key: AnswerKey;
  solution_html: string;
  is_correct?: boolean | null;
  score?: number | null;
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

export const TYPE_LABEL: Record<QuestionType, string> = {
  mcq: 'Trắc nghiệm',
  truefalse: 'Đúng/Sai',
  short: 'Trả lời ngắn',
  essay: 'Tự luận',
};

/** Questions with their options, in the order of `ids`. */
export async function loadQuestions(ids: number[]): Promise<OtQuestion[]> {
  if (ids.length === 0) return [];
  const [qs, opts] = await Promise.all([
    db().from('ot_questions').select('id, type, stem_html, topic_id, status').in('id', ids),
    db().from('ot_options').select('question_id, label, html, sort').in('question_id', ids).order('sort'),
  ]);
  const questions = unwrap(qs) as Omit<OtQuestion, 'options'>[];
  const options = unwrap(opts) as { question_id: number; label: string; html: string }[];
  const byId = new Map(questions.map((q) => [q.id, { ...q, options: [] as OtQuestion['options'] }]));
  for (const o of options) byId.get(o.question_id)?.options.push({ label: o.label, html: o.html });
  return ids.map((id) => byId.get(id)).filter((q): q is OtQuestion => Boolean(q));
}

export async function loadTopicTree(): Promise<TopicRow[]> {
  const rows = unwrap(await db().rpc('ot_topic_tree')) as TopicRow[];
  return rows.map((r) => ({
    ...r,
    total: Number(r.total),
    seen: Number(r.seen),
    correct: Number(r.correct),
  }));
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
export function hasAnswer(q: OtQuestion, r: Response): boolean {
  if (q.type === 'essay') return true;
  if (q.type === 'truefalse') return Boolean(r && typeof r === 'object' && Object.keys(r).length > 0);
  return typeof r === 'string' && r.trim() !== '';
}
