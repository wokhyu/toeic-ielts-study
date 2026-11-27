import { useCallback, useState } from 'react';
import { Mascot } from '../../components/art/Mascot.tsx';
import { IconSparkle } from '../../components/icons.tsx';
import { Badge, Button, Card, ErrorBox, Spinner } from '../../components/ui.tsx';
import { writingCriteria } from '../../content/rubrics.ts';
import { formatDateVN } from '../../lib/dates.ts';
import { formatBand } from '../../lib/ielts.ts';
import { db } from '../../lib/supabase.ts';
import { unwrap, useAsync } from '../../lib/useAsync.ts';
import type { Feedback } from '../../../supabase/functions/writing-feedback/core.ts';

interface Saved {
  feedback: Feedback;
  model: string;
  created_at: string;
}

/** The error text the Edge Function sent back, or the client's own message. */
async function functionError(error: unknown): Promise<string> {
  const fallback = error instanceof Error ? error.message : String(error);
  try {
    const body = (await (error as { context?: Response }).context?.json()) as { error?: string } | undefined;
    return body?.error ?? fallback;
  } catch {
    return fallback;
  }
}

/** AI-estimated bands and comments for the owner's Writing submission. */
export function AiFeedback({ submissionId, task }: { submissionId: number; task: 1 | 2 }) {
  const load = useCallback(async () => {
    const [saved, quota] = await Promise.all([
      db()
        .from('ai_feedback')
        .select('feedback, model, created_at')
        .eq('submission_id', submissionId)
        .maybeSingle(),
      db().rpc('ai_quota_status', { p_kind: 'writing' }),
    ]);
    const q = (unwrap(quota) as { used: number; quota: number }[])[0] ?? { used: 0, quota: 0 };
    return { saved: unwrap(saved) as Saved | null, left: Math.max(q.quota - q.used, 0), quota: q.quota };
  }, [submissionId]);
  const { data, loading, error, reload } = useAsync(load);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [fresh, setFresh] = useState<Saved | null>(null);

  const ask = async () => {
    setBusy(true);
    setFailure(null);
    const { data: body, error: err } = await db().functions.invoke('writing-feedback', {
      body: { submission_id: submissionId },
    });
    setBusy(false);
    if (err) {
      setFailure(await functionError(err));
      reload();
      return;
    }
    setFresh(body as Saved);
  };

  if (loading) return <Spinner />;
  if (error) return <ErrorBox message={error} />;
  const saved = fresh ?? data?.saved ?? null;

  if (!saved) {
    return (
      <Card variant="soft" className="flex flex-wrap items-center gap-3">
        <Mascot mood="thinking" size={48} decorative />
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold text-ink">Nhận xét bằng AI</h2>
          <p className="text-sm text-ink-soft">
            AI ước lượng band theo 4 tiêu chí, chỉ ra lỗi và viết lại một đoạn. Còn {data?.left ?? 0}/
            {data?.quota ?? 0} lượt hôm nay.
          </p>
        </div>
        <Button onClick={() => void ask()} disabled={busy || (data?.left ?? 0) === 0}>
          <IconSparkle size={15} /> {busy ? 'AI đang đọc bài…' : 'Nhận xét bài này'}
        </Button>
        {failure && (
          <div className="w-full">
            <ErrorBox message={failure} />
          </div>
        )}
      </Card>
    );
  }

  const f = saved.feedback;
  const names = Object.fromEntries(writingCriteria(task).map((c) => [c.code, c.name]));
  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <IconSparkle size={18} />
        <h2 className="mr-auto font-semibold text-ink">Nhận xét của AI</h2>
        <Badge color="lilac">band ước lượng {formatBand(f.overall)}</Badge>
      </div>
      <p className="text-xs text-ink-muted">
        Band do AI ước lượng, chỉ để tham khảo; giám khảo thật có thể chấm khác.{' '}
        {formatDateVN(saved.created_at.slice(0, 10))}
      </p>

      <ul className="grid gap-2 md:grid-cols-2">
        {f.criteria.map((c) => (
          <li key={c.code} className="rounded-2xl bg-subtle p-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-ink">{names[c.code] ?? c.code}</span>
              <span className="ml-auto">
                <Badge color="blue">{formatBand(c.band)}</Badge>
              </span>
            </div>
            {c.comment_vi && <p className="mt-1 text-sm text-ink-soft">{c.comment_vi}</p>}
          </li>
        ))}
      </ul>

      <div className="grid gap-3 md:grid-cols-2">
        <section>
          <h3 className="text-sm font-semibold text-ok-ink">Điểm mạnh</h3>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-ink">
            {f.strengths_vi.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </section>
        <section>
          <h3 className="text-sm font-semibold text-warn-ink">Nên cải thiện</h3>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-ink">
            {f.improvements_vi.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </section>
      </div>

      {f.corrections.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-ink">Sửa lỗi</h3>
          <ul className="mt-2 space-y-2">
            {f.corrections.map((c, i) => (
              <li key={i} className="rounded-2xl p-3 text-sm ring-1 ring-line">
                <p>
                  <del className="text-bad-ink">{c.original}</del>
                  <span className="text-ink-muted"> → </span>
                  <ins className="font-medium text-ok-ink no-underline">{c.suggestion}</ins>
                </p>
                {c.reason_vi && <p className="mt-1 text-ink-soft">{c.reason_vi}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {f.improved_paragraph && (
        <section>
          <h3 className="text-sm font-semibold text-ink">Một đoạn viết lại tốt hơn</h3>
          <p className="mt-1 rounded-2xl bg-subtle p-3 text-sm leading-relaxed whitespace-pre-wrap text-ink">
            {f.improved_paragraph}
          </p>
        </section>
      )}
    </Card>
  );
}
