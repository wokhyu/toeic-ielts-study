import { useCallback, useState, type FormEvent } from 'react';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Button, Card, ErrorBox, Field, inputClass, Spinner } from '../../components/ui.tsx';
import { formatDateVN, todayVN } from '../../lib/dates.ts';
import { ieltsOverall } from '../../lib/scores.ts';
import { db, errorMessage } from '../../lib/supabase.ts';
import type { MockScore } from '../../lib/types.ts';
import { unwrap, useAsync } from '../../lib/useAsync.ts';
import { useRoadmap } from './context.ts';

const SOURCES = {
  toeic: {
    label: 'Đề mẫu chính thức của ETS',
    url: 'https://www.ets.org/toeic/test-takers/sample-questions.html',
  },
  ielts: {
    label: 'Đề luyện miễn phí của British Council',
    url: 'https://takeielts.britishcouncil.org/prepare/ielts-free-practice-mock-tests/academic',
  },
};

export function ScoresPage() {
  const { program, preview } = useRoadmap();
  const load = useCallback(async () => {
    if (preview) return [] as MockScore[];
    return unwrap(
      await db().from('mock_scores').select('*').eq('course_id', program).order('taken_at').order('id'),
    ) as MockScore[];
  }, [program, preview]);
  const { data, loading, error, reload } = useAsync(load);
  const fields =
    program === 'toeic'
      ? (['listening', 'reading'] as const)
      : (['listening', 'reading', 'writing', 'speaking'] as const);
  const [form, setForm] = useState<Record<string, string>>({ week: '4', taken_at: todayVN() });
  const [saveError, setSaveError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaveError(null);
    const nums = fields.map((f) => Number((form[f] ?? '').replace(',', '.')));
    const valid =
      program === 'toeic'
        ? nums.every((n) => Number.isFinite(n) && n >= 5 && n <= 495)
        : nums.every((n) => Number.isFinite(n) && n >= 0 && n <= 9 && (n * 2) % 1 === 0);
    if (!valid) {
      setSaveError(
        program === 'toeic' ? 'Mỗi phần TOEIC từ 5 đến 495.' : 'Mỗi band IELTS từ 0 đến 9, bước 0.5.',
      );
      return;
    }
    const total = program === 'toeic' ? nums[0] + nums[1] : ieltsOverall(nums);
    const row = Object.fromEntries(fields.map((f, i) => [f, nums[i]]));
    const { error: err } = await db()
      .from('mock_scores')
      .insert({
        course_id: program,
        week: form.week ? Number(form.week) : null,
        taken_at: form.taken_at,
        total,
        ...row,
      });
    if (err) setSaveError(errorMessage(err));
    else {
      setForm({ week: '', taken_at: todayVN() });
      reload();
    }
  };

  const remove = async (id: number) => {
    const { error: err } = await db().from('mock_scores').delete().eq('id', id);
    if (err) setSaveError(errorMessage(err));
    reload();
  };

  const rows = data ?? [];
  const chart = rows.map((r) => ({ ...r, label: formatDateVN(r.taken_at).slice(0, 5) }));

  return (
    <div className="space-y-4">
      <Card>
        <p className="text-sm">
          Làm đề full test vào Thứ 7 tuần 4, 8, 12 rồi nhập điểm ở đây. Nguồn đề:{' '}
          <a
            className="text-indigo-700 underline"
            href={SOURCES[program].url}
            target="_blank"
            rel="noreferrer"
          >
            {SOURCES[program].label}
          </a>
          .
        </p>
        {!preview && (
          <form className="mt-4 grid gap-3 sm:grid-cols-3" onSubmit={(e) => void submit(e)}>
            <Field label="Tuần">
              <select
                className={inputClass}
                value={form.week}
                onChange={(e) => setForm({ ...form, week: e.target.value })}
              >
                <option value="">Không theo tuần</option>
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i} value={i + 1}>
                    Tuần {i + 1}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Ngày thi">
              <input
                type="date"
                className={inputClass}
                value={form.taken_at}
                onChange={(e) => setForm({ ...form, taken_at: e.target.value })}
              />
            </Field>
            {fields.map((f) => (
              <Field key={f} label={f[0].toUpperCase() + f.slice(1)}>
                <input
                  className={inputClass}
                  inputMode="decimal"
                  value={form[f] ?? ''}
                  onChange={(e) => setForm({ ...form, [f]: e.target.value })}
                />
              </Field>
            ))}
            <div className="flex items-end sm:col-span-3">
              <Button type="submit">Lưu điểm</Button>
            </div>
          </form>
        )}
        {saveError && (
          <div className="mt-3">
            <ErrorBox message={saveError} />
          </div>
        )}
      </Card>

      {loading ? (
        <Spinner />
      ) : error ? (
        <ErrorBox message={error} />
      ) : rows.length === 0 ? (
        <Card>Chưa có lần thi thử nào.</Card>
      ) : (
        <>
          <Card>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chart} margin={{ left: -10, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="label" fontSize={12} />
                  <YAxis fontSize={12} domain={program === 'toeic' ? [0, 990] : [0, 9]} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="total" name="Tổng" stroke="#4f46e5" strokeWidth={2} />
                  {fields.map((f, i) => (
                    <Line
                      key={f}
                      type="monotone"
                      dataKey={f}
                      stroke={['#0ea5e9', '#10b981', '#f59e0b', '#ef4444'][i]}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <Card className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-slate-500">
                <tr>
                  <th className="p-2">Ngày</th>
                  <th className="p-2">Tuần</th>
                  {fields.map((f) => (
                    <th key={f} className="p-2 capitalize">
                      {f}
                    </th>
                  ))}
                  <th className="p-2">Tổng</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-slate-100">
                    <td className="p-2">{formatDateVN(r.taken_at)}</td>
                    <td className="p-2">{r.week ?? '—'}</td>
                    {fields.map((f) => (
                      <td key={f} className="p-2">
                        {r[f] ?? '—'}
                      </td>
                    ))}
                    <td className="p-2 font-semibold">{r.total}</td>
                    <td className="p-2 text-right">
                      <Button variant="ghost" onClick={() => void remove(r.id)}>
                        Xóa
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  );
}
