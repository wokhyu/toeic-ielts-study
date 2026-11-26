import { useCallback, useState } from 'react';
import { Button, Card, Chip, EmptyState, ErrorBox, Spinner } from '../../components/ui.tsx';
import { useAuth } from '../../lib/auth-context.ts';
import { db, errorMessage } from '../../lib/supabase.ts';
import { unwrap, useAsync } from '../../lib/useAsync.ts';
import { useBank } from './context.ts';
import { idsFrom, loadQuestions, type Reveal } from './data.ts';
import { QuestionView } from './QuestionView.tsx';
import { StimulusView } from './StimulusView.tsx';

export function ReviewPage() {
  const { session } = useAuth();
  const { course } = useBank();
  const [tab, setTab] = useState<'wrong' | 'bookmarks'>('wrong');
  const [reveals, setReveals] = useState<Record<number, Reveal>>({});
  const [revealError, setRevealError] = useState<string | null>(null);

  const load = useCallback(async () => {
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
        <Chip active={tab === 'wrong'} onClick={() => setTab('wrong')}>
          Câu làm sai
        </Chip>
        <Chip active={tab === 'bookmarks'} onClick={() => setTab('bookmarks')}>
          Câu đã đánh dấu
        </Chip>
      </div>
      {revealError && <ErrorBox message={revealError} />}
      {loading ? (
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
