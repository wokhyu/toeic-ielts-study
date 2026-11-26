import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Card, ErrorBox, ProgressBar, Spinner } from '../../components/ui.tsx';
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
      <Card>
        Ngân hàng câu hỏi của khóa này chưa được nhập. Quản trị viên xem hướng dẫn import trong README.
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      {data.attempts.length > 0 && (
        <Card>
          <h2 className="mb-2 font-semibold">Bài thi gần đây</h2>
          <ul className="divide-y divide-slate-100 text-sm">
            {data.attempts.map((a) => (
              <li key={a.id} className="flex justify-between gap-3 py-2">
                <Link to={`${base}/ket-qua/${a.id}`} className="text-indigo-700 hover:underline">
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
          <h2 className="mb-2 text-lg font-semibold">{s.name}</h2>
          <div className="space-y-3">
            {s.chapters.map((c) => (
              <Card key={c.id}>
                <h3 className="mb-2 font-medium">{c.name}</h3>
                <ul className="divide-y divide-slate-100">
                  {c.topics.map((t) => (
                    <li key={t.topic_id} className="flex flex-wrap items-center gap-3 py-2 text-sm">
                      <Link
                        to={`${base}/chu-de/${t.topic_id}`}
                        className="flex-1 text-indigo-700 hover:underline"
                      >
                        {t.topic_name}
                      </Link>
                      <span className="text-xs text-slate-500">
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
