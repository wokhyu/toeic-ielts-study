import { speakingSets, writingPrompts } from '../../content/index.ts';
import type { SpeakingSet, WritingPrompt } from '../../content/schema.ts';
import { db } from '../../lib/supabase.ts';
import { unwrap } from '../../lib/useAsync.ts';

/** Writing and Speaking exist for IELTS only. */
export const IELTS_BASE = '/c/ielts';

export type SubmissionKind = 'writing' | 'speaking';

/** One recorded answer in a Speaking submission. */
export interface AudioPart {
  part: 1 | 2 | 3;
  question: string;
  /** Path in the private "speaking" bucket: <user>/<submission>/<n>.<ext> */
  path: string;
  seconds: number;
}

export interface Submission {
  id: number;
  user_id: string;
  course_id: string;
  kind: SubmissionKind;
  prompt_id: string;
  task_id: string | null;
  text: string | null;
  word_count: number;
  audio: AudioPart[];
  seconds: number | null;
  shared: boolean;
  created_at: string;
}

/** A row of submission_list(): what a list needs, with the author's name. */
export interface SubmissionSummary {
  id: number;
  user_id: string;
  author: string;
  kind: SubmissionKind;
  prompt_id: string;
  word_count: number;
  seconds: number | null;
  shared: boolean;
  created_at: string;
  reviews: number;
  peer_overall: number | null;
  reviewed_by_me: boolean;
}

export interface PeerReview {
  id: number;
  reviewer_id: string;
  reviewer: string;
  scores: Record<string, number>;
  overall: number;
  comment: string;
  created_at: string;
}

export async function listSubmissions(
  scope: 'mine' | 'others' | 'all',
  id?: number,
): Promise<SubmissionSummary[]> {
  return unwrap(
    await db().rpc('submission_list', { p_course: 'ielts', p_scope: scope, p_id: id ?? null }),
  ) as SubmissionSummary[];
}

export async function loadReviews(submissionId: number): Promise<PeerReview[]> {
  return unwrap(await db().rpc('submission_reviews', { p_submission: submissionId })) as PeerReview[];
}

export const writingPrompt = (id: string): WritingPrompt | undefined =>
  writingPrompts.find((p) => p.id === id);
export const speakingSet = (id: string): SpeakingSet | undefined => speakingSets.find((s) => s.id === id);

/** Short Vietnamese title of what was answered. */
export function promptTitle(kind: SubmissionKind, promptId: string): string {
  if (kind === 'writing') {
    const p = writingPrompt(promptId);
    return p ? `Task ${p.task} · ${p.title_vi}` : promptId;
  }
  const s = speakingSet(promptId);
  return s ? `Speaking · ${s.topic_vi}` : promptId;
}

/** Writing drafts are kept in this browser only, per prompt. */
export const draftKey = (promptId: string) => `writing-draft:${promptId}`;

export function readDraft(promptId: string): { text: string; seconds: number } | null {
  try {
    const raw = localStorage.getItem(draftKey(promptId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { text?: unknown; seconds?: unknown };
    return typeof parsed.text === 'string'
      ? { text: parsed.text, seconds: typeof parsed.seconds === 'number' ? parsed.seconds : 0 }
      : null;
  } catch {
    return null;
  }
}

export function saveDraft(promptId: string, text: string, seconds: number): void {
  try {
    if (text.trim()) localStorage.setItem(draftKey(promptId), JSON.stringify({ text, seconds }));
    else localStorage.removeItem(draftKey(promptId));
  } catch {
    // Storage blocked (private window): the draft just is not kept.
  }
}

export function clearDraft(promptId: string): void {
  try {
    localStorage.removeItem(draftKey(promptId));
  } catch {
    // ignore
  }
}
