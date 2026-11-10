import { useCallback, useState } from 'react';
import { Button, Card, ErrorBox, Spinner } from '../../components/ui.tsx';
import { useAuth } from '../../lib/auth-context.ts';
import { db, errorMessage } from '../../lib/supabase.ts';
import { unwrap, useAsync } from '../../lib/useAsync.ts';
import { idsFrom, loadQuestions, type Reveal } from './data.ts';
import { QuestionView } from './QuestionView.tsx';

export function OtReviewPage() {
  const { session } = useAuth();
  const [tab, setTab] = useState<'wrong' | 'bookmarks'>('wrong');
  const [reveals, setReveals] = useState<Record<number, Reveal>>({});
  const [revealError, setRevealError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const ids =
      tab === 'wrong'
        ? idsFrom(unwrap(await db().rpc('ot_wrong_question_ids', { p_limit: 50 })), 'ot_wrong_question_ids')
        : (
            unwrap(
              await db()
                .from('ot_bookmarks')
                .select('question_id')
                .eq('user_id', session?.user.id ?? '')
                .order('created_at', { ascending: false })
                .limit(50),
            ) as { question_id: number }[]
          ).map((r) => r.question_id);
    return loadQuestions(ids);
  }, [tab, session]);
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
        <Button variant={tab === 'wrong' ? 'primary' : 'secondary'} onClick={() => setTab('wrong')}>
          Câu làm sai
        </Button>
        <Button variant={tab === 'bookmarks' ? 'primary' : 'secondary'} onClick={() => setTab('bookmarks')}>
          Câu đã đánh dấu
        </Button>
      </div>
      {revealError && <ErrorBox message={revealError} />}
      {loading ? (
        <Spinner />
      ) : error ? (
        <ErrorBox message={error} />
      ) : (data ?? []).length === 0 ? (
        <Card>{tab === 'wrong' ? 'Chưa có câu nào làm sai.' : 'Chưa đánh dấu câu nào.'}</Card>
      ) : (
        (data ?? []).map((q, i) => (
          <Card key={q.id}>
            <QuestionView q={q} index={i + 1} response={null} reveal={reveals[q.id] ?? null} />
            {!reveals[q.id] && (
              <Button className="mt-3" variant="secondary" onClick={() => void reveal(q.id)}>
                Xem đáp án và lời giải
              </Button>
            )}
          </Card>
        ))
      )}
    </div>
  );
}
