import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Mascot } from '../../components/art/Mascot.tsx';
import { Confetti } from '../../components/effects.tsx';
import { IconArrowLeft, IconArrowRight, IconBookmark } from '../../components/icons.tsx';
import { Button, Card, EmptyState, ErrorBox, Spinner } from '../../components/ui.tsx';
import { tagLabel } from '../../content/bank.ts';
import { useAuth } from '../../lib/auth-context.ts';
import { db, errorMessage } from '../../lib/supabase.ts';
import { unwrap } from '../../lib/useAsync.ts';
import { useBank } from './context.ts';
import { hasAnswer, idsFrom, loadQuestions, type OtQuestion, type Response, type Reveal } from './data.ts';
import { QuestionView } from './QuestionView.tsx';
import { StimulusView } from './StimulusView.tsx';

const BATCH = 20;

const PRAISE = ['Chính xác!', 'Giỏi quá!', 'Tuyệt vời!', 'Đúng rồi, tiếp nào!', 'Bé Cú phục bạn luôn!'];
const NUDGE = [
  'Chưa đúng rồi, xem giải thích nhé.',
  'Sai một chút thôi, đọc lời giải rồi thử câu sau.',
  'Không sao, câu này sẽ quay lại để bạn ôn.',
];

/** Practice by topic (`chu-de/:topicId`) or by tag (`the/:tag`). Keyed so each one starts fresh. */
export function PracticePage() {
  const params = useParams();
  const tag = params.tag;
  const topicId = tag ? undefined : Number(params.topicId);
  return <Practice key={tag ? `tag:${tag}` : `topic:${topicId}`} tag={tag} topicId={topicId} />;
}

function Practice({ tag, topicId }: { tag?: string; topicId?: number }) {
  const { course, base } = useBank();
  const [queue, setQueue] = useState<OtQuestion[]>([]);
  const [offset, setOffset] = useState(0);
  const [pos, setPos] = useState(0);
  const [title, setTitle] = useState(tag ? tagLabel(course, tag) : '');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // State updates happen only after the request resolves, so this is safe to call from an effect.
  const fetchBatch = useCallback(
    (from: number) =>
      Promise.resolve(
        tag
          ? db().rpc('ot_tag_question_ids', { p_course: course, p_tag: tag, p_limit: BATCH })
          : db().rpc('ot_topic_question_ids', { p_topic: topicId, p_limit: BATCH, p_offset: from }),
      )
        .then((res) =>
          loadQuestions(idsFrom(unwrap(res), tag ? 'ot_tag_question_ids' : 'ot_topic_question_ids')),
        )
        .then(
          (questions) => {
            setQueue(questions);
            setPos(0);
            setOffset(from);
          },
          (e: unknown) => setError(errorMessage(e)),
        )
        .finally(() => setLoading(false)),
    [course, tag, topicId],
  );

  useEffect(() => {
    void fetchBatch(0);
    if (topicId !== undefined) {
      void db()
        .from('ot_topics')
        .select('name')
        .eq('id', topicId)
        .maybeSingle()
        .then(({ data }) => setTitle((data?.name as string) ?? ''));
    }
  }, [fetchBatch, topicId]);

  const next = () => {
    if (pos + 1 < queue.length) {
      setPos(pos + 1);
      return;
    }
    setLoading(true);
    void fetchBatch(tag || queue.length < BATCH ? 0 : offset + BATCH);
  };

  const q = queue[pos];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Link to={base} className="inline-flex items-center gap-1 text-brand-ink hover:underline">
          <IconArrowLeft size={15} /> Chủ đề
        </Link>
        <span className="font-semibold text-ink">{title}</span>
      </div>
      {error && <ErrorBox message={error} />}
      {loading ? (
        <Spinner />
      ) : !q ? (
        <EmptyState title="Phần này chưa có câu hỏi">
          Bé Cú đang soạn thêm. Bạn quay lại danh sách chủ đề và chọn phần khác nhé.
        </EmptyState>
      ) : (
        <PracticeCard key={q.id} q={q} index={offset + pos + 1} onNext={next} />
      )}
    </div>
  );
}

/** Keyed by question id, so the answer and explanation reset for each new question. */
export function PracticeCard({
  q,
  index,
  onNext,
  mode = 'practice',
  extra,
  task,
  onResult,
}: {
  q: OtQuestion;
  index: number;
  onNext(): void;
  /** 'review' when the question comes from the due review list; it moves the review schedule. */
  mode?: 'practice' | 'review';
  /** Extra buttons next to the usual ones. */
  extra?: ReactNode;
  /** Roadmap task this answer counts towards ("Làm ngay"). */
  task?: string;
  /** Called with the graded result. */
  onResult?(result: Reveal): void;
}) {
  const { session } = useAuth();
  const { course } = useBank();
  const userId = session?.user.id;
  const [response, setResponse] = useState<Response>(null);
  const [reveal, setReveal] = useState<Reveal | null>(null);
  const [bookmarked, setBookmarked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Time on the question, from first render to "Kiểm tra", stored with the answer.
  const shownAt = useRef(0);

  useEffect(() => {
    shownAt.current = Date.now();
  }, []);

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
      const result = unwrap(
        await db().rpc('ot_answer_practice', {
          p_question: q.id,
          p_response: response,
          p_time_ms: shownAt.current ? Date.now() - shownAt.current : null,
          p_mode: mode,
          ...(task ? { p_task: task } : {}),
        }),
      ) as Reveal;
      setReveal(result);
      onResult?.(result);
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

  const passage = q.stimulus?.kind === 'passage';
  const checkLabel =
    q.type === 'essay' ? (course === 'on-tap-11' ? 'Xem lời giải' : 'Xem giải thích') : 'Kiểm tra';

  const verdict = reveal && q.type !== 'essay' ? reveal.is_correct : null;

  return (
    <div className={`relative ${verdict === false ? 'animate-shake' : ''}`}>
      <Confetti fire={verdict === true ? index : 0} />
      <Card>
        <div className={passage ? 'grid gap-4 md:grid-cols-2' : 'space-y-4'}>
          {q.stimulus && <StimulusView stimulus={q.stimulus} showTranscript={Boolean(reveal)} />}
          <div>
            <QuestionView q={q} index={index} response={response} onChange={setResponse} reveal={reveal} />
            {verdict !== null && (
              <div
                className={`mt-4 flex items-center gap-3 rounded-2xl p-3 ${verdict ? 'bg-ok-soft' : 'bg-accent-soft'}`}
                role="status"
              >
                <span className="animate-pop">
                  <Mascot mood={verdict ? 'cheer' : 'oops'} size={48} decorative />
                </span>
                <p className={`text-sm font-medium ${verdict ? 'text-ok-ink' : 'text-accent-ink'}`}>
                  {(verdict ? PRAISE : NUDGE)[index % (verdict ? PRAISE.length : NUDGE.length)]}
                </p>
              </div>
            )}
            {error && (
              <div className="mt-3">
                <ErrorBox message={error} />
              </div>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              {!reveal ? (
                <Button onClick={() => void check()} disabled={busy || !hasAnswer(q, response)}>
                  {checkLabel}
                </Button>
              ) : (
                <Button onClick={onNext}>
                  Câu tiếp <IconArrowRight size={16} />
                </Button>
              )}
              {!reveal && (
                <Button variant="ghost" onClick={onNext}>
                  Bỏ qua
                </Button>
              )}
              <Button
                variant="ghost"
                onClick={() => void toggleBookmark()}
                aria-pressed={bookmarked}
                className={bookmarked ? 'text-accent-ink' : ''}
              >
                <IconBookmark size={16} filled={bookmarked} /> {bookmarked ? 'Đã đánh dấu' : 'Đánh dấu'}
              </Button>
              {extra}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
