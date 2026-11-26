import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { IconCheck, IconPencil, IconTarget } from '../../components/icons.tsx';
import {
  Card,
  EmptyState,
  ErrorBox,
  InfoHint,
  ProgressBar,
  Spinner,
  StatTile,
} from '../../components/ui.tsx';
import { useAuth } from '../../lib/auth-context.ts';
import { formatDateVN, toDateVN } from '../../lib/dates.ts';
import { percent } from '../../lib/streak.ts';
import { db } from '../../lib/supabase.ts';
import { unwrap, useAsync } from '../../lib/useAsync.ts';
import { useBank } from './context.ts';
import { loadTopicTree, toTree } from './data.ts';
import { attemptScore, type AttemptSummary } from './results.ts';

export function BankHomePage() {
  const { session } = useAuth();
  const { course, base } = useBank();
  const load = useCallback(async () => {
    const [rows, attempts] = await Promise.all([
      loadTopicTree(course),
      db()
        .from('ot_attempts')
        .select('id, mode, submitted_at, score, max_score, config')
        .eq('user_id', session?.user.id ?? '')
        .eq('course_id', course)
        .not('submitted_at', 'is', null)
        .order('submitted_at', { ascending: false })
        .limit(10),
    ]);
    return { tree: toTree(rows), attempts: unwrap(attempts) as AttemptSummary[] };
  }, [session, course]);
  const { data, loading, error } = useAsync(load);

  if (loading) return <Spinner />;
  if (error) return <ErrorBox message={error} />;
  if (!data || data.tree.length === 0) {
    return (
      <EmptyState title="Ngân hàng câu hỏi đang trống">
        Câu hỏi của khóa này chưa được nhập. Quản trị viên xem hướng dẫn import trong README.
      </EmptyState>
    );
  }

  const topics = data.tree.flatMap((s) => s.chapters.flatMap((c) => c.topics));
  const seen = topics.reduce((n, t) => n + t.seen, 0);
  const right = topics.reduce((n, t) => n + t.correct, 0);
  const total = topics.reduce((n, t) => n + t.total, 0);

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile label="Câu đã làm" value={`${seen}/${total}`} icon={<IconPencil />} tone="brand" />
        <StatTile label="Câu đã làm đúng" value={right} icon={<IconCheck />} tone="mint" />
        <StatTile
          label="Độ chính xác"
          value={
            <span className="inline-flex items-center gap-1">
              {seen > 0 ? `${percent(right, seen)}%` : '—'}
              <InfoHint label="độ chính xác">
                Số câu bạn đã từng làm đúng chia cho số câu đã làm. Làm càng nhiều câu thì con số này càng
                phản ánh đúng trình độ của bạn.
              </InfoHint>
            </span>
          }
          icon={<IconTarget />}
          tone="accent"
        />
      </div>
      {data.attempts.length > 0 && (
        <Card>
          <h2 className="mb-2 font-semibold text-ink">Bài thi gần đây</h2>
          <ul className="divide-y divide-line text-sm">
            {data.attempts.map((a) => (
              <li key={a.id} className="flex justify-between gap-3 py-2">
                <Link to={`${base}/ket-qua/${a.id}`} className="text-brand-ink hover:underline">
                  {a.mode === 'mock' ? 'Thi thử' : 'Bài thi'} ngày{' '}
                  {formatDateVN(toDateVN(a.submitted_at ?? ''))}
                </Link>
                <span className="font-medium">{attemptScore(course, a)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
      {data.tree.map((s) => (
        <section key={s.id}>
          <h2 className="mb-2 text-lg font-semibold tracking-tight text-ink">{s.name}</h2>
          <div className="space-y-3">
            {s.chapters.map((c) => (
              <Card key={c.id}>
                <h3 className="mb-2 font-semibold text-ink">{c.name}</h3>
                <ul className="divide-y divide-line">
                  {c.topics.map((t) => (
                    <li key={t.topic_id} className="flex flex-wrap items-center gap-3 py-2.5 text-sm">
                      <Link
                        to={`${base}/chu-de/${t.topic_id}`}
                        className="flex-1 font-medium text-brand-ink hover:underline"
                      >
                        {t.topic_name}
                      </Link>
                      <span className="text-xs text-ink-muted">
                        {t.seen}/{t.total} đã làm · {t.correct} đúng
                      </span>
                      <span className="w-28">
                        <ProgressBar value={percent(t.seen, t.total)} />
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
