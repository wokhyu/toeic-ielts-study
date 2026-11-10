import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { Rich } from '../../components/Rich.tsx';
import { Badge, Button, Card, ErrorBox, PageHeader, Spinner } from '../../components/ui.tsx';
import { db, errorMessage } from '../../lib/supabase.ts';
import { unwrap, useAsync } from '../../lib/useAsync.ts';
import { loadQuestions, TYPE_LABEL, type OtQuestion, type QuestionType } from '../ot/data.ts';

const PAGE = 10;

/** Questions imported without an answer key ("needs_review"); the admin fills them in. */
export function AdminReviewPage() {
  const [type, setType] = useState<QuestionType>('mcq');
  const [page, setPage] = useState(0);
  const load = useCallback(async () => {
    const res = await db()
      .from('ot_questions')
      .select('id', { count: 'exact' })
      .eq('status', 'needs_review')
      .eq('type', type)
      .order('id')
      .range(page * PAGE, page * PAGE + PAGE - 1);
    const ids = (unwrap(res) as { id: number }[]).map((r) => r.id);
    return { count: res.count ?? 0, questions: await loadQuestions(ids) };
  }, [type, page]);
  const { data, loading, error, reload } = useAsync(load);

  return (
    <div className="space-y-4">
      <Link to="/admin" className="text-sm text-indigo-700 hover:underline">
        ← Quản trị
      </Link>
      <PageHeader
        title="Duyệt đáp án on-tap-11"
        subtitle="Câu chưa có đáp án không hiện với học viên. Gán đáp án để mở, hoặc ẩn câu lỗi."
      />
      <div className="flex flex-wrap gap-2">
        {(['mcq', 'truefalse', 'short', 'essay'] as const).map((t) => (
          <Button
            key={t}
            variant={type === t ? 'primary' : 'secondary'}
            onClick={() => {
              setType(t);
              setPage(0);
            }}
          >
            {TYPE_LABEL[t]}
          </Button>
        ))}
      </div>
      {loading ? (
        <Spinner />
      ) : error ? (
        <ErrorBox message={error} />
      ) : (
        <>
          <p className="text-sm text-slate-600">Còn {data?.count ?? 0} câu.</p>
          {(data?.questions ?? []).map((q) => (
            <ReviewItem key={q.id} q={q} onDone={reload} />
          ))}
          <div className="flex gap-2">
            <Button variant="secondary" disabled={page === 0} onClick={() => setPage(page - 1)}>
              Trang trước
            </Button>
            <Button
              variant="secondary"
              disabled={(page + 1) * PAGE >= (data?.count ?? 0)}
              onClick={() => setPage(page + 1)}
            >
              Trang sau
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function ReviewItem({ q, onDone }: { q: OtQuestion; onDone(): void }) {
  const [mcq, setMcq] = useState('');
  const [tf, setTf] = useState<Record<string, boolean>>({});
  const [short, setShort] = useState('');
  const [error, setError] = useState<string | null>(null);

  const key =
    q.type === 'mcq'
      ? mcq || null
      : q.type === 'truefalse'
        ? Object.keys(tf).length
          ? tf
          : null
        : q.type === 'short'
          ? short.trim() || null
          : null;
  const ready =
    q.type === 'essay' || (q.type === 'truefalse' ? q.options.every((o) => o.label in tf) : Boolean(key));

  const save = async (status: 'ok' | 'hidden') => {
    const { error: err } = await db().rpc('ot_admin_set_key', {
      p_question: q.id,
      p_key: key,
      p_status: status,
    });
    if (err) setError(errorMessage(err));
    else onDone();
  };

  return (
    <Card>
      <div className="mb-2 flex gap-2">
        <Badge>#{q.id}</Badge>
        <Badge>{TYPE_LABEL[q.type]}</Badge>
      </div>
      <Rich html={q.stem_html} />
      <div className="mt-3 grid gap-2 text-sm">
        {q.options.map((o) => (
          <div key={o.label} className="flex flex-wrap items-start gap-2">
            {q.type === 'mcq' && (
              <input
                type="radio"
                name={`k${q.id}`}
                checked={mcq === o.label}
                onChange={() => setMcq(o.label)}
              />
            )}
            <b>{o.label}.</b>
            <span className="flex-1">
              <Rich html={o.html} />
            </span>
            {q.type === 'truefalse' &&
              [true, false].map((v) => (
                <button
                  key={String(v)}
                  type="button"
                  onClick={() => setTf({ ...tf, [o.label]: v })}
                  className={`rounded px-2 py-0.5 text-xs ring-1 ${tf[o.label] === v ? 'bg-indigo-600 text-white' : 'ring-slate-300'}`}
                >
                  {v ? 'Đúng' : 'Sai'}
                </button>
              ))}
          </div>
        ))}
        {q.type === 'short' && (
          <input
            className="w-48 rounded border border-slate-300 px-2 py-1"
            placeholder="Đáp số"
            value={short}
            onChange={(e) => setShort(e.target.value)}
          />
        )}
      </div>
      {error && (
        <div className="mt-2">
          <ErrorBox message={error} />
        </div>
      )}
      <div className="mt-3 flex gap-2">
        <Button disabled={!ready} onClick={() => void save('ok')}>
          {q.type === 'essay' ? 'Mở câu (không chấm tự động)' : 'Lưu đáp án và mở câu'}
        </Button>
        <Button variant="secondary" onClick={() => void save('hidden')}>
          Ẩn câu
        </Button>
      </div>
    </Card>
  );
}
