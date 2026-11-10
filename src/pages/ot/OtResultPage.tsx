import { useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Card, ErrorBox, Spinner } from '../../components/ui.tsx';
import { toTen } from '../../lib/scores.ts';
import { db } from '../../lib/supabase.ts';
import { unwrap, useAsync } from '../../lib/useAsync.ts';
import { loadQuestions, type AnswerKey, type Response } from './data.ts';
import { QuestionView } from './QuestionView.tsx';

interface ReviewRow {
  question_id: number;
  response: Response;
  is_correct: boolean | null;
  score: number | null;
  answer_key: AnswerKey;
  solution_html: string;
}

export function OtResultPage() {
  const attemptId = Number(useParams().attemptId);
  const load = useCallback(async () => {
    const attempt = unwrap(
      await db().from('ot_attempts').select('score, max_score').eq('id', attemptId).single(),
    ) as { score: number; max_score: number };
    const rows = unwrap(await db().rpc('ot_attempt_review', { p_attempt: attemptId })) as ReviewRow[];
    const questions = await loadQuestions(rows.map((r) => r.question_id));
    return { attempt, rows, questions };
  }, [attemptId]);
  const { data, loading, error } = useAsync(load);

  if (loading) return <Spinner />;
  if (error) return <ErrorBox message={error} />;
  if (!data) return null;

  const byId = new Map(data.rows.map((r) => [r.question_id, r]));
  const correct = data.rows.filter((r) => r.is_correct).length;

  return (
    <div className="space-y-4">
      <Card>
        <p className="text-3xl font-semibold">{toTen(data.attempt.score, data.attempt.max_score)}/10</p>
        <p className="mt-1 text-sm text-slate-600">
          Đúng hoàn toàn {correct}/{data.rows.length} câu.{' '}
          <Link to="/c/on-tap-11/thi-thu" className="text-indigo-700 underline">
            Thi bài khác
          </Link>
        </p>
      </Card>
      {data.questions.map((q, i) => {
        const r = byId.get(q.id);
        return (
          <Card key={q.id}>
            <QuestionView
              q={q}
              index={i + 1}
              response={r?.response ?? null}
              reveal={
                r
                  ? {
                      answer_key: r.answer_key,
                      solution_html: r.solution_html,
                      is_correct: r.is_correct,
                      score: r.score,
                    }
                  : null
              }
            />
          </Card>
        );
      })}
    </div>
  );
}
