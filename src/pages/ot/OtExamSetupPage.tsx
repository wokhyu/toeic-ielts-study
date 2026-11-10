import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, ErrorBox, Field, inputClass, Spinner } from '../../components/ui.tsx';
import { db, errorMessage } from '../../lib/supabase.ts';
import { useAsync } from '../../lib/useAsync.ts';
import { loadTopicTree, toTree, TYPE_LABEL, type QuestionType } from './data.ts';

const TYPES: QuestionType[] = ['mcq', 'truefalse', 'short'];

export function OtExamSetupPage() {
  const navigate = useNavigate();
  const load = useCallback(async () => toTree(await loadTopicTree()), []);
  const { data, loading, error } = useAsync(load);
  const [topics, setTopics] = useState<Set<number>>(new Set());
  const [count, setCount] = useState(20);
  const [minutes, setMinutes] = useState(30);
  const [types, setTypes] = useState<Set<QuestionType>>(new Set(['mcq']));
  const [busy, setBusy] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  if (loading) return <Spinner />;
  if (error) return <ErrorBox message={error} />;

  const toggle = <T,>(set: Set<T>, v: T) => {
    const next = new Set(set);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    return next;
  };

  const start = async () => {
    setBusy(true);
    setStartError(null);
    const { data: id, error: err } = await db().rpc('ot_start_exam', {
      p_topic_ids: [...topics],
      p_count: count,
      p_minutes: minutes,
      p_types: [...types],
    });
    setBusy(false);
    if (err) {
      setStartError(
        /no questions/.test(err.message) ? 'Không có câu hỏi phù hợp với lựa chọn.' : errorMessage(err),
      );
      return;
    }
    navigate(`/c/on-tap-11/thi-thu/${id}`);
  };

  return (
    <div className="space-y-4">
      <Card>
        <h2 className="mb-3 font-semibold">1. Chọn chủ đề</h2>
        <div className="space-y-4">
          {(data ?? []).map((s) => (
            <div key={s.id}>
              <p className="mb-1 text-sm font-semibold">{s.name}</p>
              {s.chapters.map((c) => {
                const ids = c.topics.map((t) => t.topic_id);
                const allOn = ids.every((id) => topics.has(id));
                return (
                  <div key={c.id} className="mb-2 ml-1">
                    <label className="flex items-center gap-2 text-sm font-medium">
                      <input
                        type="checkbox"
                        className="accent-indigo-600"
                        checked={allOn}
                        onChange={() =>
                          setTopics((set) => {
                            const next = new Set(set);
                            ids.forEach((id) => (allOn ? next.delete(id) : next.add(id)));
                            return next;
                          })
                        }
                      />
                      {c.name}
                    </label>
                    <div className="ml-6 grid gap-1 sm:grid-cols-2">
                      {c.topics.map((t) => (
                        <label key={t.topic_id} className="flex items-center gap-2 text-sm text-slate-700">
                          <input
                            type="checkbox"
                            className="accent-indigo-600"
                            checked={topics.has(t.topic_id)}
                            onChange={() => setTopics((set) => toggle(set, t.topic_id))}
                          />
                          {t.topic_name} <span className="text-xs text-slate-400">({t.total})</span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </Card>
      <Card className="grid gap-4 sm:grid-cols-3">
        <Field label="Số câu (1–100)">
          <input
            type="number"
            min={1}
            max={100}
            className={inputClass}
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
          />
        </Field>
        <Field label="Thời gian (phút, 0 = không giới hạn)">
          <input
            type="number"
            min={0}
            max={240}
            className={inputClass}
            value={minutes}
            onChange={(e) => setMinutes(Number(e.target.value))}
          />
        </Field>
        <div className="text-sm">
          <span className="mb-1 block font-medium text-slate-700">Dạng câu</span>
          {TYPES.map((t) => (
            <label key={t} className="mr-3 inline-flex items-center gap-1">
              <input
                type="checkbox"
                className="accent-indigo-600"
                checked={types.has(t)}
                onChange={() => setTypes((set) => toggle(set, t))}
              />
              {TYPE_LABEL[t]}
            </label>
          ))}
        </div>
      </Card>
      {startError && <ErrorBox message={startError} />}
      <Button onClick={() => void start()} disabled={busy || topics.size === 0 || types.size === 0}>
        Bắt đầu thi
      </Button>
    </div>
  );
}
