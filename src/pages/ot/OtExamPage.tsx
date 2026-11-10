import { useCallback, useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { Button, Card, ErrorBox, Spinner } from '../../components/ui.tsx';
import { db, errorMessage } from '../../lib/supabase.ts';
import { unwrap, useAsync } from '../../lib/useAsync.ts';
import { hasAnswer, idsFrom, loadQuestions, type Response } from './data.ts';
import { QuestionView } from './QuestionView.tsx';

interface Attempt {
  id: number;
  deadline_at: string | null;
  submitted_at: string | null;
}

function formatClock(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

export function OtExamPage() {
  const attemptId = Number(useParams().attemptId);
  const navigate = useNavigate();
  const [responses, setResponses] = useState<Record<number, Response>>({});
  const [now, setNow] = useState(() => Date.now());
  const [saveError, setSaveError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const submitted = useRef(false);

  const load = useCallback(async () => {
    const attempt = unwrap(
      await db().from('ot_attempts').select('id, deadline_at, submitted_at').eq('id', attemptId).single(),
    ) as Attempt;
    const ids = idsFrom(
      unwrap(await db().rpc('ot_attempt_questions', { p_attempt: attemptId })),
      'ot_attempt_questions',
    );
    const [questions, saved] = await Promise.all([
      loadQuestions(ids),
      db().from('ot_attempt_answers').select('question_id, response').eq('attempt_id', attemptId),
    ]);
    const initial: Record<number, Response> = {};
    for (const r of unwrap(saved) as { question_id: number; response: Response }[])
      initial[r.question_id] = r.response;
    setResponses(initial);
    return { attempt, questions };
  }, [attemptId]);
  const { data, loading, error } = useAsync(load);

  const submit = useCallback(async () => {
    if (submitted.current) return;
    submitted.current = true;
    setSubmitting(true);
    const { error: err } = await db().rpc('ot_submit_exam', { p_attempt: attemptId });
    if (err) {
      submitted.current = false;
      setSubmitting(false);
      setSaveError(errorMessage(err));
      return;
    }
    navigate(`/c/on-tap-11/ket-qua/${attemptId}`, { replace: true });
  }, [attemptId, navigate]);

  const deadline = data?.attempt.deadline_at ? new Date(data.attempt.deadline_at).getTime() : null;

  const finished = Boolean(data?.attempt.submitted_at);

  // Tick the clock and submit automatically once time is up.
  useEffect(() => {
    if (!deadline || finished) return;
    const t = setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= deadline) void submit();
    }, 1000);
    return () => clearInterval(t);
  }, [deadline, finished, submit]);

  if (loading) return <Spinner />;
  if (error) return <ErrorBox message={error} />;
  if (!data) return null;
  if (data.attempt.submitted_at) return <Navigate to={`/c/on-tap-11/ket-qua/${attemptId}`} replace />;

  const change = async (questionId: number, r: Response) => {
    setResponses((m) => ({ ...m, [questionId]: r }));
    const { data: ok, error: err } = await db().rpc('ot_save_answer', {
      p_attempt: attemptId,
      p_question: questionId,
      p_response: r,
    });
    if (err) setSaveError(errorMessage(err));
    else if (!ok) setSaveError('Không lưu được câu trả lời: bài thi đã hết giờ hoặc đã nộp.');
    else setSaveError(null);
  };

  const answered = data.questions.filter(
    (q) => hasAnswer(q, responses[q.id] ?? null) && q.type !== 'essay',
  ).length;

  return (
    <div className="space-y-4">
      <Card className="sticky top-2 z-10 flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm">
          Đã làm {answered}/{data.questions.length} câu
        </span>
        {deadline && (
          <span className={`font-mono text-lg ${deadline - now < 60_000 ? 'text-rose-600' : ''}`}>
            {formatClock(deadline - now)}
          </span>
        )}
        <Button onClick={() => void submit()} disabled={submitting}>
          Nộp bài
        </Button>
      </Card>
      {saveError && <ErrorBox message={saveError} />}
      {data.questions.map((q, i) => (
        <Card key={q.id}>
          <QuestionView
            q={q}
            index={i + 1}
            response={responses[q.id] ?? null}
            onChange={(r) => void change(q.id, r)}
            disabled={submitting}
          />
        </Card>
      ))}
    </div>
  );
}
