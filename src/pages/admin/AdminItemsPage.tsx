import { Fragment, useCallback, useMemo, useState } from 'react';
import { Rich } from '../../components/Rich.tsx';
import { Badge, Button, Card, Chip, EmptyState, ErrorBox, InfoHint, Spinner } from '../../components/ui.tsx';
import { tagLabel } from '../../content/bank.ts';
import { loadQuestions, type OtQuestion } from '../../features/bank/data.ts';
import { downloadCsv, toCsv, type CsvColumn } from '../../lib/csv.ts';
import { formatDuration } from '../../lib/stats.ts';
import { db } from '../../lib/supabase.ts';
import type { CourseId } from '../../lib/types.ts';
import { unwrap, useAsync } from '../../lib/useAsync.ts';
import { todayVN } from '../../lib/dates.ts';
import { ADMIN_COURSES, useAdminCourse } from './useAdminCourse.ts';

interface ItemRow {
  question_id: number;
  ext_id: string | null;
  chapter: string | null;
  topic: string | null;
  tags: string[] | null;
  type: string;
  n: number;
  correct: number;
  p: number;
  r_pb: number | null;
  median_time_ms: number | null;
  options: Record<string, number>;
  answer_key: unknown;
  flags: string[];
}

const MIN_N = 10;

const FLAG: Record<string, { label: string; color: 'yellow' | 'red' | 'blue' | 'coral' }> = {
  too_easy: { label: 'Quá dễ', color: 'blue' },
  too_hard: { label: 'Quá khó', color: 'yellow' },
  negative_discrimination: { label: 'Phân biệt ngược', color: 'red' },
  unused_distractor: { label: 'Phương án thừa', color: 'coral' },
};

type SortKey = 'flags' | 'p' | 'r_pb' | 'n';

export function AdminItemsPage() {
  const [courseParam, setCourse] = useAdminCourse(false);
  const course: CourseId = courseParam ?? 'toeic';
  const [chapter, setChapter] = useState('');
  const [tag, setTag] = useState('');
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [sort, setSort] = useState<SortKey>('flags');
  const [open, setOpen] = useState<number | null>(null);

  const load = useCallback(
    async () =>
      unwrap(await db().rpc('admin_item_analysis', { p_course: course, p_min: MIN_N })) as ItemRow[],
    [course],
  );
  const { data, loading, error } = useAsync(load);
  const all = useMemo(() => data ?? [], [data]);
  const chapters = [...new Set(all.map((r) => r.chapter).filter(Boolean))] as string[];
  const tags = [...new Set(all.flatMap((r) => r.tags ?? []))].sort();

  const rows = useMemo(() => {
    const list = all.filter(
      (r) =>
        (!chapter || r.chapter === chapter) &&
        (!tag || (r.tags ?? []).includes(tag)) &&
        (!flaggedOnly || r.flags.length > 0),
    );
    const cmp: Record<SortKey, (a: ItemRow, b: ItemRow) => number> = {
      flags: (a, b) => b.flags.length - a.flags.length || b.n - a.n,
      p: (a, b) => a.p - b.p,
      r_pb: (a, b) => (a.r_pb ?? 2) - (b.r_pb ?? 2),
      n: (a, b) => b.n - a.n,
    };
    return list.sort(cmp[sort]);
  }, [all, chapter, tag, flaggedOnly, sort]);

  const enough = all.filter((r) => r.n >= MIN_N).length;
  const flagged = all.filter((r) => r.flags.length > 0).length;

  const exportCsv = () => {
    const columns: CsvColumn<ItemRow>[] = [
      { label: 'Mã câu', value: (r) => r.ext_id ?? r.question_id },
      { label: 'Phần', value: (r) => r.chapter },
      { label: 'Chủ đề', value: (r) => r.topic },
      { label: 'Chủ điểm', value: (r) => (r.tags ?? []).map((t) => tagLabel(course, t)).join('; ') },
      { label: 'Số người làm (lần đầu)', value: (r) => r.n },
      { label: 'Số người đúng', value: (r) => r.correct },
      { label: 'Độ khó p', value: (r) => r.p },
      { label: 'Độ phân biệt r', value: (r) => r.r_pb },
      {
        label: 'Thời gian trung vị (giây)',
        value: (r) => (r.median_time_ms ? r.median_time_ms / 1000 : null),
      },
      {
        label: 'Phân bố lựa chọn',
        value: (r) =>
          Object.entries(r.options)
            .sort()
            .map(([k, v]) => `${k}:${v}`)
            .join(' '),
      },
      { label: 'Cờ', value: (r) => r.flags.map((f) => FLAG[f]?.label ?? f).join('; ') },
    ];
    downloadCsv(`chat-luong-cau-hoi-${course}-${todayVN()}.csv`, toCsv(rows, columns));
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        {ADMIN_COURSES.map((c) => (
          <Chip
            key={c.id}
            active={course === c.id}
            onClick={() => {
              setCourse(c.id);
              setChapter('');
              setTag('');
              setOpen(null);
            }}
          >
            {c.label}
          </Chip>
        ))}
      </div>

      <Card variant="soft" className="text-sm leading-relaxed text-ink-soft">
        <p>
          Phân tích theo lý thuyết trắc nghiệm cổ điển, chỉ dùng <b>lần trả lời đầu tiên</b> của mỗi học viên
          cho mỗi câu (các lần sau là luyện lại nên dễ hơn) và không tính tài khoản admin. Cờ chỉ bật khi câu
          có từ {MIN_N} người làm.
        </p>
        <p className="mt-1">
          {all.length} câu đã có người làm · {enough} câu đủ {MIN_N} người · <b>{flagged}</b> câu bị gắn cờ.
        </p>
      </Card>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <select
          className="rounded-lg border border-line-strong bg-surface px-2.5 py-1.5 text-ink"
          value={chapter}
          onChange={(e) => setChapter(e.target.value)}
          aria-label="Lọc theo phần"
        >
          <option value="">Mọi phần</option>
          {chapters.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        {tags.length > 0 && (
          <select
            className="rounded-lg border border-line-strong bg-surface px-2.5 py-1.5 text-ink"
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            aria-label="Lọc theo chủ điểm"
          >
            <option value="">Mọi chủ điểm</option>
            {tags.map((t) => (
              <option key={t} value={t}>
                {tagLabel(course, t)}
              </option>
            ))}
          </select>
        )}
        <Chip active={flaggedOnly} onClick={() => setFlaggedOnly((f) => !f)}>
          Chỉ câu bị gắn cờ
        </Chip>
        <label className="ml-auto flex items-center gap-2 text-ink-soft">
          Sắp xếp
          <select
            className="rounded-lg border border-line-strong bg-surface px-2.5 py-1.5 text-ink"
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
          >
            <option value="flags">Nhiều cờ trước</option>
            <option value="p">Khó nhất trước</option>
            <option value="r_pb">Phân biệt kém nhất trước</option>
            <option value="n">Nhiều người làm nhất</option>
          </select>
        </label>
        <Button variant="secondary" size="sm" onClick={exportCsv} disabled={rows.length === 0}>
          Xuất CSV
        </Button>
      </div>

      {loading ? (
        <Spinner label="Đang tính thống kê từng câu…" />
      ) : error ? (
        <ErrorBox message={error} />
      ) : all.length === 0 ? (
        <EmptyState title="Chưa có ai làm câu nào của khóa này">
          Số liệu sẽ có sau khi học viên luyện tập hoặc làm bài thi trên web.
        </EmptyState>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="text-xs text-ink-muted">
              <tr>
                <th className="p-2 font-medium">Câu</th>
                <th className="p-2 text-right font-medium">Người làm</th>
                <th className="p-2 font-medium">
                  Độ khó p{' '}
                  <InfoHint label="độ khó p">
                    Tỉ lệ người làm đúng ngay lần đầu. 0,2–0,9 là vùng tốt cho luyện tập; trên 0,9 gần như ai
                    cũng đúng (quá dễ), dưới 0,2 gần như ai cũng sai (có thể khó quá hoặc đáp án/đề có vấn
                    đề).
                  </InfoHint>
                </th>
                <th className="p-2 text-right font-medium">
                  Phân biệt r{' '}
                  <InfoHint label="độ phân biệt">
                    Tương quan điểm-nhị phân (đã hiệu chỉnh): người làm đúng câu này có giỏi hơn ở các câu
                    khác không. Từ 0,2 trở lên là tốt; gần 0 là câu không phân biệt được trình độ; âm nghĩa là
                    người giỏi lại hay sai — nên xem lại đáp án hoặc cách hỏi.
                  </InfoHint>
                </th>
                <th className="p-2 text-right font-medium">Thời gian</th>
                <th className="p-2 font-medium">
                  Lựa chọn{' '}
                  <InfoHint label="phân tích phương án nhiễu">
                    Số người chọn từng phương án ở lần đầu; phương án đúng có dấu ✓. Phương án sai mà không ai
                    chọn là phương án thừa, nên thay bằng lựa chọn hợp lý hơn.
                  </InfoHint>
                </th>
                <th className="p-2 font-medium">Cờ</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <Fragment key={r.question_id}>
                  <tr
                    className={`cursor-pointer border-t border-line align-middle hover:bg-subtle ${open === r.question_id ? 'bg-subtle' : ''}`}
                    onClick={() => setOpen(open === r.question_id ? null : r.question_id)}
                  >
                    <td className="p-2">
                      <button
                        type="button"
                        className="text-left font-medium text-brand-ink hover:underline"
                        aria-expanded={open === r.question_id}
                      >
                        {r.ext_id ?? `#${r.question_id}`}
                      </button>
                      <div className="text-xs text-ink-muted">
                        {[r.chapter, r.topic].filter(Boolean).join(' · ')}
                      </div>
                    </td>
                    <td className="p-2 text-right tabular-nums">
                      {r.n}
                      {r.n < MIN_N && <div className="text-xs text-ink-faint">chưa đủ</div>}
                    </td>
                    <td className="p-2">
                      <div className="flex items-center gap-2">
                        <span className="w-10 text-right tabular-nums">
                          {r.p.toFixed(2).replace('.', ',')}
                        </span>
                        <span className="relative h-2 w-20 rounded-full bg-muted">
                          <span
                            className="absolute inset-y-0 left-0 rounded-full bg-brand"
                            style={{ width: `${r.p * 100}%` }}
                          />
                        </span>
                      </div>
                    </td>
                    <td
                      className={`p-2 text-right tabular-nums ${r.r_pb !== null && r.r_pb < 0 ? 'font-semibold text-bad-ink' : ''}`}
                    >
                      {r.r_pb === null ? '—' : r.r_pb.toFixed(2).replace('.', ',')}
                    </td>
                    <td className="p-2 text-right whitespace-nowrap">{formatDuration(r.median_time_ms)}</td>
                    <td className="p-2">
                      <OptionCounts row={r} />
                    </td>
                    <td className="p-2">
                      <div className="flex flex-wrap gap-1">
                        {r.flags.map((f) => (
                          <Badge key={f} color={FLAG[f]?.color ?? 'gray'}>
                            {FLAG[f]?.label ?? f}
                          </Badge>
                        ))}
                      </div>
                    </td>
                  </tr>
                  {open === r.question_id && (
                    <tr className="bg-subtle">
                      <td colSpan={7} className="p-3">
                        <ItemDetail row={r} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

function keyOf(row: ItemRow): string | null {
  return typeof row.answer_key === 'string' ? row.answer_key : null;
}

function OptionCounts({ row }: { row: ItemRow }) {
  const entries = Object.entries(row.options).sort(([a], [b]) => a.localeCompare(b));
  if (entries.length === 0) return <span className="text-ink-faint">—</span>;
  const key = keyOf(row);
  return (
    <span className="flex flex-wrap gap-1 text-xs tabular-nums">
      {entries.map(([label, count]) => (
        <span
          key={label}
          className={`rounded-md px-1.5 py-0.5 ${label === key ? 'bg-ok-soft text-ok-ink' : 'bg-muted text-ink-soft'}`}
        >
          {label === key ? '✓ ' : ''}
          {label}: {count}
        </span>
      ))}
    </span>
  );
}

/** The question itself with a bar per option, so the admin can see why a distractor works or not. */
function ItemDetail({ row }: { row: ItemRow }) {
  const load = useCallback(
    async () => (await loadQuestions([row.question_id]))[0] ?? null,
    [row.question_id],
  );
  const { data, loading, error } = useAsync<OtQuestion | null>(load);
  if (loading) return <Spinner />;
  if (error) return <ErrorBox message={error} />;
  if (!data) return <p className="text-sm text-ink-muted">Không tải được câu hỏi.</p>;
  const key = keyOf(row);
  const total = Math.max(
    1,
    Object.values(row.options).reduce((a, b) => a + b, 0),
  );
  return (
    <div className="space-y-3 text-sm">
      {data.stimulus?.html && (
        <details className="rounded-xl bg-surface p-3 ring-1 ring-line">
          <summary className="cursor-pointer font-medium">Đoạn văn / bài nghe</summary>
          <div className="mt-2 max-h-60 overflow-y-auto">
            <Rich html={data.stimulus.html} />
          </div>
        </details>
      )}
      {data.stem_html && <Rich html={data.stem_html} />}
      {data.options.length > 0 && (
        <ul className="space-y-1.5">
          {data.options.map((o) => {
            const count = row.options[o.label] ?? 0;
            const isKey = o.label === key;
            return (
              <li key={o.label} className="grid grid-cols-[minmax(0,1fr)_8rem_3rem] items-center gap-3">
                <span className={isKey ? 'font-semibold text-ok-ink' : 'text-ink'}>
                  {isKey ? '✓ ' : ''}
                  {o.label}. <Rich html={o.html} />
                </span>
                <span className="h-2.5 rounded-full bg-muted">
                  <span
                    className={`block h-2.5 rounded-full ${isKey ? 'bg-ok' : 'bg-ink-faint'}`}
                    style={{ width: `${(count / total) * 100}%` }}
                  />
                </span>
                <span className="text-right text-ink-soft tabular-nums">{count}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
