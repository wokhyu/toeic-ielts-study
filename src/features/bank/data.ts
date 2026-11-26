import type { AnswerKey, BankQuestion, Stimulus, TopicRow } from '../../lib/bank.ts';
import type { CourseId } from '../../lib/types.ts';
import { db } from '../../lib/supabase.ts';
import { unwrap } from '../../lib/useAsync.ts';

export type {
  AnswerKey,
  BankQuestion as OtQuestion,
  QuestionType,
  Response,
  Stimulus,
  TopicRow,
} from '../../lib/bank.ts';
export { hasAnswer, idsFrom, toTree } from '../../lib/bank.ts';

/** Progress on the roadmap task a practice answer counted towards. */
export interface TaskProgressInfo {
  id: string;
  answered: number;
  count: number;
  done: boolean;
}

export interface Reveal {
  answer_key: AnswerKey;
  solution_html: string;
  is_correct?: boolean | null;
  score?: number | null;
  /** Set when the answer was given for a roadmap task ("Làm ngay"). */
  task?: TaskProgressInfo | null;
}

export interface MockTest {
  id: string;
  title: string;
  minutes: number;
  week: number | null;
  sections: { key: string; label: string }[];
}

export interface MockSection {
  label: string;
  raw: number;
  max: number;
  scaled: number;
}

export const TYPE_LABEL: Record<BankQuestion['type'], string> = {
  mcq: 'Trắc nghiệm',
  truefalse: 'Đúng/Sai',
  short: 'Trả lời ngắn',
  essay: 'Tự luận',
};

/** Questions with their options and shared passage, in the order of `ids`. */
export async function loadQuestions(ids: number[]): Promise<BankQuestion[]> {
  if (ids.length === 0) return [];
  const [qs, opts] = await Promise.all([
    db()
      .from('ot_questions')
      .select('id, type, stem_html, topic_id, status, stimulus_id, set_id, tags')
      .in('id', ids),
    db().from('ot_options').select('question_id, label, html, sort').in('question_id', ids).order('sort'),
  ]);
  const questions = unwrap(qs) as Omit<BankQuestion, 'options'>[];
  const options = unwrap(opts) as { question_id: number; label: string; html: string }[];
  const stimulusIds = [
    ...new Set(questions.map((q) => q.stimulus_id).filter((id): id is number => id !== null)),
  ];
  const stimuli =
    stimulusIds.length > 0
      ? (unwrap(
          await db().from('ot_stimuli').select('id, kind, title, html, audio_script').in('id', stimulusIds),
        ) as Stimulus[])
      : [];
  const stimulusById = new Map(stimuli.map((s) => [s.id, s]));
  const byId = new Map<number, BankQuestion>();
  for (const q of questions) {
    const stimulus = q.stimulus_id !== null ? stimulusById.get(q.stimulus_id) : undefined;
    byId.set(q.id, { ...q, tags: q.tags ?? [], options: [], ...(stimulus ? { stimulus } : {}) });
  }
  for (const o of options) byId.get(o.question_id)?.options.push({ label: o.label, html: o.html });
  return ids.map((id) => byId.get(id)).filter((q): q is BankQuestion => Boolean(q));
}

export async function loadTopicTree(course: CourseId): Promise<TopicRow[]> {
  const rows = unwrap(await db().rpc('ot_topic_tree', { p_course: course })) as TopicRow[];
  return rows.map((r) => ({
    ...r,
    total: Number(r.total),
    seen: Number(r.seen),
    correct: Number(r.correct),
  }));
}

export async function loadMockTests(course: CourseId): Promise<MockTest[]> {
  return unwrap(
    await db()
      .from('ot_mock_tests')
      .select('id, title, minutes, week, sections')
      .eq('course_id', course)
      .order('sort'),
  ) as MockTest[];
}
