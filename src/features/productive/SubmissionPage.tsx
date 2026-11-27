import { useCallback, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Mascot } from '../../components/art/Mascot.tsx';
import { Confetti } from '../../components/effects.tsx';
import { IconArrowLeft, IconUsers } from '../../components/icons.tsx';
import { Badge, Button, Card, EmptyState, ErrorBox, InfoHint, Spinner } from '../../components/ui.tsx';
import { BAND_GUIDE, SPEAKING_CRITERIA, writingCriteria, type Criterion } from '../../content/rubrics.ts';
import { useAuth } from '../../lib/auth-context.ts';
import { formatDateVN } from '../../lib/dates.ts';
import { clock, formatBand, ieltsRound } from '../../lib/ielts.ts';
import { db, errorMessage } from '../../lib/supabase.ts';
import { unwrap, useAsync } from '../../lib/useAsync.ts';
import {
  IELTS_BASE,
  listSubmissions,
  loadReviews,
  promptTitle,
  speakingSet,
  writingPrompt,
  type Submission,
} from './data.ts';
import { AiFeedback } from './AiFeedback.tsx';
import { WritingVisual } from './WritingVisual.tsx';

/** `bai/:submissionId`: the work itself, its peer reviews, and the review form for classmates. */
export function SubmissionPage() {
  const id = Number(useParams().submissionId);
  const [params] = useSearchParams();
  const reviewTask = params.get('nv');
  const { session } = useAuth();
  const me = session?.user.id;

  const load = useCallback(async () => {
    const [submission, summary, reviews] = await Promise.all([
      db().from('submissions').select('*').eq('id', id).maybeSingle(),
      listSubmissions('all', id),
      loadReviews(id),
    ]);
    const row = unwrap(submission) as Submission | null;
    if (!row) return null;
    const urls =
      row.kind === 'speaking' && row.audio.length > 0
        ? ((
            unwrap(
              await db()
                .storage.from('speaking')
                .createSignedUrls(
                  row.audio.map((a) => a.path),
                  3600,
                ),
            ) as { signedUrl: string | null }[]
          ).map((u) => u.signedUrl) ?? [])
        : [];
    return { row, author: summary[0]?.author ?? '', reviews, urls };
  }, [id]);
  const { data, loading, error, reload } = useAsync(load);

  if (loading) return <Spinner />;
  if (error) return <ErrorBox message={error} />;
  if (!data) {
    return (
      <EmptyState title="Không xem được bài này">
        Bài không tồn tại, hoặc chủ bài chưa chia sẻ với bạn cùng khóa.
      </EmptyState>
    );
  }

  const { row, author, reviews, urls } = data;
  const mine = row.user_id === me;
  const reviewed = reviews.some((r) => r.reviewer_id === me);
  const peerOverall = reviews.length
    ? ieltsRound(reviews.reduce((s, r) => s + Number(r.overall), 0) / reviews.length)
    : null;
  const prompt = row.kind === 'writing' ? writingPrompt(row.prompt_id) : undefined;
  const set = row.kind === 'speaking' ? speakingSet(row.prompt_id) : undefined;
  const criteria = row.kind === 'writing' ? writingCriteria(prompt?.task ?? 2) : SPEAKING_CRITERIA;

  return (
    <div className="space-y-4">
      <Link
        to={`${IELTS_BASE}/viet-noi?tab=${mine ? 'cua-toi' : 'cham-cheo'}`}
        className="inline-flex items-center gap-1 text-sm text-brand-ink hover:underline"
      >
        <IconArrowLeft size={15} /> Viết & Nói
      </Link>

      <Card className="space-y-3">
        <div className="flex flex-wrap items-start gap-2">
          <div className="mr-auto">
            <p className="text-xs text-ink-muted">
              {mine ? 'Bài của bạn' : author} · {formatDateVN(row.created_at.slice(0, 10))}
            </p>
            <h1 className="text-lg font-semibold text-ink">{promptTitle(row.kind, row.prompt_id)}</h1>
          </div>
          {peerOverall !== null && (
            <Badge color="blue">
              <IconUsers size={12} /> band bạn chấm {formatBand(peerOverall)}
            </Badge>
          )}
          {mine && <ShareToggle row={row} onChanged={reload} />}
        </div>

        {prompt && (
          <details className="rounded-2xl bg-subtle p-3 text-sm">
            <summary className="cursor-pointer font-medium text-ink">Đề bài</summary>
            <p className="mt-2 whitespace-pre-line text-ink">{prompt.prompt}</p>
            {prompt.visuals?.map((v, i) => (
              <div key={i} className="mt-3">
                <WritingVisual visual={v} />
              </div>
            ))}
          </details>
        )}

        {row.kind === 'writing' ? (
          <>
            <p className="text-xs text-ink-muted">
              {row.word_count} từ{row.seconds ? ` · viết trong ${clock(row.seconds)}` : ''}
            </p>
            <div className="rounded-2xl bg-surface p-4 leading-relaxed whitespace-pre-wrap text-ink ring-1 ring-line">
              {row.text}
            </div>
          </>
        ) : (
          <ol className="space-y-3">
            {row.audio.map((a, i) => (
              <li key={a.path} className="space-y-1">
                <p className="text-sm text-ink">
                  <Badge>Part {a.part}</Badge> {a.part === 2 && set ? set.part2.cue : a.question}
                </p>
                {urls[i] ? (
                  <audio controls preload="none" src={urls[i] ?? undefined} className="h-9 w-full max-w-md" />
                ) : (
                  <p className="text-xs text-ink-muted">Không tải được bản ghi.</p>
                )}
              </li>
            ))}
            {row.audio.length === 0 && <p className="text-sm text-ink-muted">Bài này chưa có bản ghi nào.</p>}
          </ol>
        )}
      </Card>

      {mine && row.kind === 'writing' && <AiFeedback submissionId={row.id} task={prompt?.task ?? 2} />}

      <section className="space-y-2">
        <h2 className="font-semibold text-ink">Nhận xét của bạn cùng khóa ({reviews.length})</h2>
        {reviews.length === 0 ? (
          <p className="text-sm text-ink-muted">
            {mine
              ? row.shared
                ? 'Chưa có ai chấm. Bài đang được chia sẻ nên bạn cùng khóa sẽ thấy trong mục Chấm chéo.'
                : 'Bài chưa được chia sẻ nên chưa ai chấm được.'
              : 'Chưa có ai chấm bài này.'}
          </p>
        ) : (
          reviews.map((r) => (
            <Card key={r.id} className="space-y-2">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium text-ink">{r.reviewer_id === me ? 'Bạn' : r.reviewer}</span>
                <span className="text-xs text-ink-muted">{formatDateVN(r.created_at.slice(0, 10))}</span>
                <span className="ml-auto">
                  <Badge color="blue">band {formatBand(r.overall)}</Badge>
                </span>
              </div>
              <div className="flex flex-wrap gap-1">
                {criteria.map((c) => (
                  <Badge key={c.code}>
                    {c.code} {formatBand(r.scores[c.code])}
                  </Badge>
                ))}
              </div>
              <p className="text-sm whitespace-pre-wrap text-ink">{r.comment}</p>
            </Card>
          ))
        )}
      </section>

      {!mine && row.shared && !reviewed && (
        <ReviewForm submissionId={row.id} criteria={criteria} taskId={reviewTask} onDone={reload} />
      )}
    </div>
  );
}

function ShareToggle({ row, onChanged }: { row: Submission; onChanged(): void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toggle = async () => {
    setBusy(true);
    const { error: err } = await db().from('submissions').update({ shared: !row.shared }).eq('id', row.id);
    setBusy(false);
    if (err) setError(errorMessage(err));
    else onChanged();
  };
  return (
    <div className="text-right">
      <Button size="sm" variant={row.shared ? 'ghost' : 'soft'} onClick={() => void toggle()} disabled={busy}>
        {row.shared ? 'Đang chia sẻ · tắt' : 'Chia sẻ để được chấm chéo'}
      </Button>
      {error && <p className="text-xs text-bad-ink">{error}</p>}
    </div>
  );
}

const BANDS = Array.from({ length: 17 }, (_, i) => 1 + i * 0.5);

function ReviewForm({
  submissionId,
  criteria,
  taskId,
  onDone,
}: {
  submissionId: number;
  criteria: Criterion[];
  taskId: string | null;
  onDone(): void;
}) {
  const [scores, setScores] = useState<Record<string, number>>({});
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(0);
  const complete = criteria.every((c) => scores[c.code] !== undefined) && comment.trim().length >= 10;
  const preview = complete
    ? ieltsRound(criteria.reduce((s, c) => s + scores[c.code], 0) / criteria.length)
    : null;

  const submit = async () => {
    setBusy(true);
    setError(null);
    const { error: err } = await db()
      .from('peer_reviews')
      .insert({ submission_id: submissionId, scores, comment: comment.trim(), task_id: taskId });
    setBusy(false);
    if (err) {
      setError(errorMessage(err));
      return;
    }
    setSent((n) => n + 1);
    onDone();
  };

  return (
    <Card className="relative space-y-4">
      <Confetti fire={sent} />
      <div className="flex items-center gap-3">
        <Mascot mood="thinking" size={48} decorative />
        <div>
          <h2 className="font-semibold text-ink">Chấm bài này</h2>
          <p className="text-sm text-ink-soft">Chọn band cho từng tiêu chí, rồi viết nhận xét cụ thể.</p>
        </div>
        <InfoHint label="thang band">
          <ul className="space-y-1">
            {BAND_GUIDE.map((g) => (
              <li key={g.band}>
                <b>Band {g.band}:</b> {g.text}
              </li>
            ))}
          </ul>
        </InfoHint>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {criteria.map((c) => (
          <label key={c.code} className="block space-y-1 rounded-2xl bg-subtle p-3">
            <span className="block text-sm font-medium text-ink">{c.name}</span>
            <span className="block text-xs text-ink-muted">{c.hint}</span>
            <select
              className="mt-1 w-full rounded-lg border border-line-strong bg-surface px-2.5 py-1.5 text-sm text-ink"
              value={scores[c.code] ?? ''}
              onChange={(e) => setScores((s) => ({ ...s, [c.code]: Number(e.target.value) }))}
            >
              <option value="" disabled>
                Chọn band
              </option>
              {BANDS.map((b) => (
                <option key={b} value={b}>
                  {b.toFixed(1)}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <label className="block space-y-1">
        <span className="text-sm font-medium text-ink">Nhận xét</span>
        <textarea
          className="min-h-28 w-full rounded-2xl border border-line-strong bg-surface p-3 text-sm text-ink"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Một điểm làm tốt, một điểm nên sửa, kèm ví dụ trong bài."
        />
      </label>
      {error && <ErrorBox message={error} />}
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => void submit()} disabled={!complete || busy}>
          Gửi nhận xét
        </Button>
        {preview !== null && <span className="text-sm text-ink-soft">Band tổng: {formatBand(preview)}</span>}
      </div>
    </Card>
  );
}
