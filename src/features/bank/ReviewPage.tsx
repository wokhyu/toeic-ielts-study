import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { buttonClass } from '../../components/styles.ts';
import { Button, Card, Chip, EmptyState, ErrorBox, Spinner } from '../../components/ui.tsx';
import type { CourseId } from '../../lib/types.ts';
import { useAuth } from '../../lib/auth-context.ts';
import { db, errorMessage } from '../../lib/supabase.ts';
import { unwrap, useAsync } from '../../lib/useAsync.ts';
import { useBank } from './context.ts';
import { idsFrom, loadQuestions, type OtQuestion, type Reveal } from './data.ts';
import { PracticeCard } from './PracticePage.tsx';
import { QuestionView } from './QuestionView.tsx';
import { StimulusView } from './StimulusView.tsx';

export function ReviewPage() {
  const { session } = useAuth();
  const { course } = useBank();
  const [tab, setTab] = useState<'due' | 'wrong' | 'bookmarks'>('due');
  const [reveals, setReveals] = useState<Record<number, Reveal>>({});
  const [revealError, setRevealError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (tab === 'due') return [];
    if (tab === 'wrong') {
      const res = await db().rpc('ot_wrong_question_ids', { p_limit: 50, p_course: course });
      return loadQuestions(idsFrom(unwrap(res), 'ot_wrong_question_ids'));
    }
    const rows = unwrap(
      await db()
        .from('ot_bookmarks')
        .select('question_id, ot_questions!inner(course_id)')
        .eq('user_id', session?.user.id ?? '')
        .eq('ot_questions.course_id', course)
        .order('created_at', { ascending: false })
        .limit(50),
    ) as { question_id: number }[];
    return loadQuestions(rows.map((r) => r.question_id));
  }, [tab, session, course]);
  const { data, loading, error } = useAsync(load);

  const reveal = async (id: number) => {
    const { data: r, error: err } = await db().rpc('ot_reveal', { p_question: id });
    if (err)
      setRevealError(
        /answer the question first/.test(err.message)
          ? 'Làm câu này trước rồi mới xem đáp án.'
          : errorMessage(err),
      );
    else setReveals((m) => ({ ...m, [id]: r as Reveal }));
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Chip active={tab === 'due'} onClick={() => setTab('due')}>
          Đến hạn ôn
        </Chip>
        <Chip active={tab === 'wrong'} onClick={() => setTab('wrong')}>
          Câu làm sai
        </Chip>
        <Chip active={tab === 'bookmarks'} onClick={() => setTab('bookmarks')}>
          Câu đã đánh dấu
        </Chip>
      </div>
      {revealError && <ErrorBox message={revealError} />}
      {tab === 'due' ? (
        <DueQueue course={course} />
      ) : loading ? (
        <Spinner />
      ) : error ? (
        <ErrorBox message={error} />
      ) : (data ?? []).length === 0 ? (
        <EmptyState
          title={tab === 'wrong' ? 'Chưa có câu nào làm sai' : 'Chưa đánh dấu câu nào'}
          mood={tab === 'wrong' ? 'cheer' : 'happy'}
        >
          {tab === 'wrong'
            ? 'Làm sai câu nào, câu đó sẽ hiện ở đây để bạn ôn lại.'
            : 'Bấm “Đánh dấu” khi luyện tập để lưu câu hay hoặc câu khó.'}
        </EmptyState>
      ) : (
        (data ?? []).map((q, i) => (
          <Card key={q.id}>
            <div className={q.stimulus?.kind === 'passage' ? 'grid gap-4 md:grid-cols-2' : 'space-y-4'}>
              {q.stimulus && <StimulusView stimulus={q.stimulus} showTranscript={Boolean(reveals[q.id])} />}
              <div>
                <QuestionView q={q} index={i + 1} response={null} reveal={reveals[q.id] ?? null} />
                {!reveals[q.id] && (
                  <Button className="mt-3" variant="secondary" onClick={() => void reveal(q.id)}>
                    Xem đáp án và giải thích
                  </Button>
                )}
              </div>
            </div>
          </Card>
        ))
      )}
    </div>
  );
}

/**
 * Missed questions due today: answer each again (counted as review, which moves
 * it to 3 then 7 days, and off the list after three correct answers in a row),
 * or mark it "Đã hiểu" to drop it without answering.
 */
function DueQueue({ course }: { course: CourseId }) {
  const { base } = useBank();
  const [pos, setPos] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    const res = await db().rpc('ot_due_review_ids', { p_course: course, p_limit: 30 });
    return loadQuestions(idsFrom(unwrap(res), 'ot_due_review_ids'));
  }, [course]);
  const { data, loading, error: loadError } = useAsync(load);

  if (loading) return <Spinner />;
  if (loadError) return <ErrorBox message={loadError} />;
  const queue: OtQuestion[] = data ?? [];
  const q = queue[pos];
  if (!q) {
    return (
      <EmptyState
        title={queue.length > 0 ? 'Xong lượt ôn hôm nay!' : 'Hôm nay không có câu nào đến hạn'}
        mood="cheer"
        action={
          <Link to={base} className={buttonClass('soft')}>
            Luyện thêm câu mới
          </Link>
        }
      >
        Câu làm sai sẽ quay lại sau 1 ngày, rồi 3 và 7 ngày. Đúng 3 lần liền là câu đó ra khỏi danh sách.
      </EmptyState>
    );
  }

  const dismiss = async () => {
    const { error: err } = await db().rpc('ot_dismiss_review', { p_question: q.id });
    if (err) setError(errorMessage(err));
    else setPos((p) => p + 1);
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-soft">
        Câu {pos + 1}/{queue.length} đến hạn ôn hôm nay
      </p>
      {error && <ErrorBox message={error} />}
      <PracticeCard
        key={q.id}
        q={q}
        index={pos + 1}
        mode="review"
        onNext={() => setPos((p) => p + 1)}
        extra={
          <Button variant="ghost" onClick={() => void dismiss()} title="Bỏ câu này khỏi danh sách ôn">
            Đã hiểu
          </Button>
        }
      />
    </div>
  );
}
