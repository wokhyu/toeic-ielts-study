import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button, Card, ErrorBox, Spinner } from '../../components/ui.tsx';
import { useAuth } from '../../lib/auth-context.ts';
import { db, errorMessage } from '../../lib/supabase.ts';
import { unwrap } from '../../lib/useAsync.ts';
import { hasAnswer, idsFrom, loadQuestions, type OtQuestion, type Response, type Reveal } from './data.ts';
import { QuestionView } from './QuestionView.tsx';

const BATCH = 20;

/** Keyed by topic so every topic starts with fresh state. */
export function OtPracticePage() {
  const topicId = Number(useParams().topicId);
  return <TopicPractice key={topicId} topicId={topicId} />;
}

function TopicPractice({ topicId }: { topicId: number }) {
  const [queue, setQueue] = useState<OtQuestion[]>([]);
  const [offset, setOffset] = useState(0);
  const [pos, setPos] = useState(0);
  const [topicName, setTopicName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // State updates happen only after the request resolves, so this is safe to call from an effect.
  const fetchBatch = useCallback(
    (from: number) =>
      Promise.resolve(db().rpc('ot_topic_question_ids', { p_topic: topicId, p_limit: BATCH, p_offset: from }))
        .then((res) => loadQuestions(idsFrom(unwrap(res), 'ot_topic_question_ids')))
        .then(
          (questions) => {
            setQueue(questions);
            setPos(0);
            setOffset(from);
          },
          (e: unknown) => setError(errorMessage(e)),
        )
        .finally(() => setLoading(false)),
    [topicId],
  );

  useEffect(() => {
    void fetchBatch(0);
    void db()
      .from('ot_topics')
      .select('name')
      .eq('id', topicId)
      .maybeSingle()
      .then(({ data }) => setTopicName((data?.name as string) ?? ''));
  }, [fetchBatch, topicId]);

  const next = () => {
    if (pos + 1 < queue.length) {
      setPos(pos + 1);
      return;
    }
    setLoading(true);
    void fetchBatch(queue.length < BATCH ? 0 : offset + BATCH);
  };

  const q = queue[pos];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Link to="/c/on-tap-11" className="text-indigo-700 hover:underline">
          ← Chủ đề
        </Link>
        <span className="font-medium">{topicName}</span>
      </div>
      {error && <ErrorBox message={error} />}
      {loading ? (
        <Spinner />
      ) : !q ? (
        <Card>Chủ đề này chưa có câu hỏi.</Card>
      ) : (
        <PracticeCard key={q.id} q={q} index={offset + pos + 1} onNext={next} />
      )}
    </div>
  );
}

/** Keyed by question id, so the answer and solution reset for each new question. */
function PracticeCard({ q, index, onNext }: { q: OtQuestion; index: number; onNext(): void }) {
  const { session } = useAuth();
  const userId = session?.user.id;
  const [response, setResponse] = useState<Response>(null);
  const [reveal, setReveal] = useState<Reveal | null>(null);
  const [bookmarked, setBookmarked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!userId) return;
    void db()
      .from('ot_bookmarks')
      .select('question_id')
      .eq('question_id', q.id)
      .eq('user_id', userId)
      .then(({ data }) => setBookmarked((data ?? []).length > 0));
  }, [q.id, userId]);

  const check = async () => {
    setBusy(true);
    setError(null);
    try {
      setReveal(
        unwrap(await db().rpc('ot_answer_practice', { p_question: q.id, p_response: response })) as Reveal,
      );
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const toggleBookmark = async () => {
    const { data, error: err } = await db().rpc('ot_toggle_bookmark', { p_question: q.id });
    if (err) setError(errorMessage(err));
    else setBookmarked(Boolean(data));
  };

  return (
    <Card>
      <QuestionView q={q} index={index} response={response} onChange={setResponse} reveal={reveal} />
      {error && (
        <div className="mt-3">
          <ErrorBox message={error} />
        </div>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        {!reveal ? (
          <Button onClick={() => void check()} disabled={busy || !hasAnswer(q, response)}>
            {q.type === 'essay' ? 'Xem lời giải' : 'Kiểm tra'}
          </Button>
        ) : (
          <Button onClick={onNext}>Câu tiếp</Button>
        )}
        {!reveal && (
          <Button variant="ghost" onClick={onNext}>
            Bỏ qua
          </Button>
        )}
        <Button variant="ghost" onClick={() => void toggleBookmark()}>
          {bookmarked ? '★ Đã đánh dấu' : '☆ Đánh dấu'}
        </Button>
      </div>
    </Card>
  );
}
