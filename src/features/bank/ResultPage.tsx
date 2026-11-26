import { useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Mascot } from '../../components/art/Mascot.tsx';
import { Confetti } from '../../components/effects.tsx';
import { IconCheck } from '../../components/icons.tsx';
import { roadmaps } from '../../content/index.ts';
import type { Task } from '../../content/schema.ts';
import { findTask, mockTaskFor } from '../../lib/roadmap.ts';
import type { CourseId } from '../../lib/types.ts';
import { buttonClass } from '../../components/styles.ts';
import { Card, ProgressRing, Spinner, ErrorBox } from '../../components/ui.tsx';
import { groupByStimulus } from '../../lib/bank.ts';
import { db } from '../../lib/supabase.ts';
import { unwrap, useAsync } from '../../lib/useAsync.ts';
import { useBank } from './context.ts';
import { loadQuestions, type AnswerKey, type Response } from './data.ts';
import { QuestionView } from './QuestionView.tsx';
import { attemptScore, type AttemptSummary } from './results.ts';
import { StimulusView } from './StimulusView.tsx';

interface ReviewRow {
  question_id: number;
  response: Response;
  is_correct: boolean | null;
  score: number | null;
  answer_key: AnswerKey;
  solution_html: string;
}

/** The roadmap task a submitted attempt ticked: its own task, or the mock task of the mock's week. */
async function tickedTask(course: CourseId, attempt: AttemptSummary): Promise<Task | undefined> {
  if (course === 'on-tap-11' || !attempt.submitted_at) return undefined;
  if (attempt.task_id) return findTask(roadmaps[course], attempt.task_id)?.task;
  if (!attempt.mock_test_id) return undefined;
  const { data } = await db()
    .from('ot_mock_tests')
    .select('week')
    .eq('id', attempt.mock_test_id)
    .maybeSingle();
  const week = (data?.week as number | null | undefined) ?? null;
  return week ? mockTaskFor(roadmaps[course], week) : undefined;
}

export function ResultPage() {
  const attemptId = Number(useParams().attemptId);
  const { course, base } = useBank();
  const load = useCallback(async () => {
    const attempt = unwrap(
      await db()
        .from('ot_attempts')
        .select('id, mode, submitted_at, score, max_score, config, task_id, mock_test_id')
        .eq('id', attemptId)
        .single(),
    ) as AttemptSummary;
    const rows = unwrap(await db().rpc('ot_attempt_review', { p_attempt: attemptId })) as ReviewRow[];
    const questions = await loadQuestions(rows.map((r) => r.question_id));
    return { attempt, rows, questions, task: await tickedTask(course, attempt) };
  }, [attemptId, course]);
  const { data, loading, error } = useAsync(load);

  if (loading) return <Spinner />;
  if (error) return <ErrorBox message={error} />;
  if (!data) return null;

  const byId = new Map(data.rows.map((r) => [r.question_id, r]));
  const correct = data.rows.filter((r) => r.is_correct).length;
  const sections = data.attempt.config?.sections;
  const graded = data.rows.filter((r) => r.is_correct !== null).length;
  const ratio = graded > 0 ? (correct / graded) * 100 : 0;
  const mood = ratio >= 80 ? 'cheer' : ratio >= 50 ? 'happy' : 'thinking';
  const message =
    ratio >= 80
      ? 'Xuất sắc! Bạn nắm phần này rất chắc.'
      : ratio >= 50
        ? 'Khá lắm! Xem lại các câu sai bên dưới để lên điểm nhé.'
        : 'Bắt đầu vậy là tốt rồi. Đọc kỹ lời giải, các câu sai sẽ quay lại ở mục Ôn lại.';

  return (
    <div className="space-y-4">
      <Card variant="hero" className="relative overflow-hidden">
        <Confetti fire={ratio >= 80 ? attemptId : 0} pieces={26} />
        <div className="flex flex-wrap items-center gap-4">
          <Mascot mood={mood} size={84} decorative />
          <div className="mr-auto">
            <p className="text-sm text-ink-soft">Kết quả</p>
            <p className="text-3xl font-semibold text-ink">{attemptScore(course, data.attempt)}</p>
            <p className="mt-1 text-sm text-ink-soft">{message}</p>
          </div>
          {graded > 0 && (
            <ProgressRing value={ratio} size={84} stroke={9} label="Tỉ lệ câu đúng">
              {correct}/{graded}
            </ProgressRing>
          )}
        </div>
        {sections && (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {Object.entries(sections).map(([key, s]) => (
              <div key={key} className="rounded-2xl bg-surface p-3 text-sm ring-1 ring-line">
                <p className="font-medium">{s.label}</p>
                <p>
                  {s.raw}/{s.max} câu đúng · quy đổi{' '}
                  <b>{course === 'ielts' ? `band ${Number(s.scaled).toFixed(1)}` : s.scaled}</b>
                </p>
              </div>
            ))}
            <p className="text-xs text-ink-muted sm:col-span-2">
              Điểm quy đổi là ước lượng theo bảng của đề này, không phải điểm thi chính thức. Đã lưu vào trang
              Điểm thi thử.
            </p>
          </div>
        )}
        {data.task && (
          <p className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl bg-ok-soft p-3 text-sm text-ok-ink">
            <IconCheck size={16} strokeWidth={3} />
            <span className="mr-auto">
              Đã tích nhiệm vụ: <b>{data.task.title}</b>
            </span>
            <Link to={`/c/${course}/hom-nay`} className="font-medium underline">
              Về Hôm nay
            </Link>
          </p>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-ink-soft">
          <span>
            Đúng {correct}/{data.rows.length} câu.
          </span>
          <Link to={`${base}/thi-thu`} className={buttonClass('secondary', 'sm')}>
            Thi bài khác
          </Link>
          <Link to={`${base}/on-lai`} className={buttonClass('soft', 'sm')}>
            Ôn lại câu sai
          </Link>
        </div>
      </Card>
      {groupByStimulus(data.questions).map((g) => (
        <Card key={g.items[0].q.id}>
          <div className={g.stimulus?.kind === 'passage' ? 'grid gap-4 md:grid-cols-2' : 'space-y-4'}>
            {g.stimulus && <StimulusView stimulus={g.stimulus} showTranscript />}
            <div className="space-y-5">
              {g.items.map(({ q, index }) => {
                const r = byId.get(q.id);
                return (
                  <QuestionView
                    key={q.id}
                    q={q}
                    index={index}
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
                );
              })}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
