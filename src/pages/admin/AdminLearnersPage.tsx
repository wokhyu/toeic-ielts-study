import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Sparkline } from '../../components/charts/Sparkline.tsx';
import { IconClock, IconFlame } from '../../components/icons.tsx';
import { Badge, Button, Card, Chip, EmptyState, ErrorBox, InfoHint, Spinner } from '../../components/ui.tsx';
import { tagLabel } from '../../content/bank.ts';
import { daysBetween, formatDateVN, todayVN } from '../../lib/dates.ts';
import { downloadCsv, toCsv, type CsvColumn } from '../../lib/csv.ts';
import { percent } from '../../lib/streak.ts';
import { db } from '../../lib/supabase.ts';
import type { CourseId } from '../../lib/types.ts';
import { unwrap, useAsync } from '../../lib/useAsync.ts';
import { ADMIN_COURSES, useAdminCourse } from './useAdminCourse.ts';

interface LearnerRow {
  user_id: string;
  display_name: string;
  email: string;
  track: string | null;
  start_date: string | null;
  last_active: string | null;
  current_streak: number;
  spark: number[];
  answers_30d: number;
  correct_30d: number;
  tasks_done: number;
  tasks_total: number;
  cards_30d: number;
  latest_mock: number | null;
  weakest_tag: string | null;
  weakest_n: number | null;
  weakest_correct: number | null;
}

/** Days since the learner last studied, or null if never. */
function idleDays(r: LearnerRow, today: string): number | null {
  return r.last_active ? daysBetween(r.last_active, today) : null;
}

type SortKey = 'name' | 'last' | 'answers' | 'accuracy' | 'progress' | 'mock';

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'last', label: 'Học gần nhất' },
  { key: 'answers', label: 'Số câu' },
  { key: 'accuracy', label: 'Độ chính xác' },
  { key: 'progress', label: 'Tiến độ lộ trình' },
  { key: 'mock', label: 'Điểm thi thử' },
  { key: 'name', label: 'Tên' },
];

const IDLE_WARN = 5;

export function AdminLearnersPage() {
  const [courseParam, setCourse] = useAdminCourse(false);
  const course: CourseId = courseParam ?? 'toeic';
  const [sort, setSort] = useState<SortKey>('last');
  const today = todayVN();
  const load = useCallback(
    async () => unwrap(await db().rpc('admin_learners', { p_course: course })) as LearnerRow[],
    [course],
  );
  const { data, loading, error } = useAsync(load);
  const roadmap = course !== 'on-tap-11';

  const rows = useMemo(() => {
    const list = [...(data ?? [])];
    const acc = (r: LearnerRow) => (r.answers_30d ? r.correct_30d / r.answers_30d : -1);
    const prog = (r: LearnerRow) => (r.tasks_total ? r.tasks_done / r.tasks_total : -1);
    const cmp: Record<SortKey, (a: LearnerRow, b: LearnerRow) => number> = {
      name: (a, b) => a.display_name.localeCompare(b.display_name, 'vi'),
      last: (a, b) => (b.last_active ?? '').localeCompare(a.last_active ?? ''),
      answers: (a, b) => b.answers_30d - a.answers_30d,
      accuracy: (a, b) => acc(b) - acc(a),
      progress: (a, b) => prog(b) - prog(a),
      mock: (a, b) => (b.latest_mock ?? -1) - (a.latest_mock ?? -1),
    };
    return list.sort(cmp[sort]);
  }, [data, sort]);

  const idle = rows.filter((r) => (idleDays(r, today) ?? Infinity) > IDLE_WARN);

  const exportCsv = () => {
    const columns: CsvColumn<LearnerRow>[] = [
      { label: 'Tên', value: (r) => r.display_name },
      { label: 'Email', value: (r) => r.email },
      { label: 'Nhánh', value: (r) => r.track },
      { label: 'Học gần nhất', value: (r) => r.last_active },
      { label: 'Chuỗi ngày', value: (r) => r.current_streak },
      { label: 'Hoạt động 14 ngày', value: (r) => r.spark.reduce((a, b) => a + b, 0) },
      { label: 'Câu đã làm 30 ngày', value: (r) => r.answers_30d },
      { label: 'Câu đúng 30 ngày', value: (r) => r.correct_30d },
      { label: 'Nhiệm vụ xong', value: (r) => r.tasks_done },
      { label: 'Tổng nhiệm vụ của nhánh', value: (r) => r.tasks_total },
      { label: 'Lượt ôn thẻ 30 ngày', value: (r) => r.cards_30d },
      { label: 'Điểm thi thử gần nhất', value: (r) => r.latest_mock },
      { label: 'Chủ điểm yếu nhất', value: (r) => (r.weakest_tag ? tagLabel(course, r.weakest_tag) : '') },
    ];
    downloadCsv(`hoc-vien-${course}-${today}.csv`, toCsv(rows, columns));
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        {ADMIN_COURSES.map((c) => (
          <Chip key={c.id} active={course === c.id} onClick={() => setCourse(c.id)}>
            {c.label}
          </Chip>
        ))}
        <span className="ml-auto" />
        <label className="flex items-center gap-2 text-sm text-ink-soft">
          Sắp xếp
          <select
            className="rounded-lg border border-line-strong bg-surface px-2.5 py-1.5 text-sm text-ink"
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
          >
            {SORTS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <Button variant="secondary" size="sm" onClick={exportCsv} disabled={rows.length === 0}>
          Xuất CSV
        </Button>
      </div>

      {loading ? (
        <Spinner />
      ) : error ? (
        <ErrorBox message={error} />
      ) : rows.length === 0 ? (
        <EmptyState title="Chưa có học viên nào được duyệt vào khóa này" />
      ) : (
        <>
          {idle.length > 0 && (
            <Card variant="soft" className="flex flex-wrap items-center gap-2 text-sm">
              <IconClock className="text-warn" />
              <span>
                <b>{idle.length}</b> học viên đã ngưng học hơn {IDLE_WARN} ngày:{' '}
                {idle.map((r, i) => (
                  <span key={r.user_id}>
                    {i > 0 && ', '}
                    <Link
                      to={`/admin/nguoi-dung/${r.user_id}`}
                      className="font-medium text-brand-ink hover:underline"
                    >
                      {r.display_name}
                    </Link>
                  </span>
                ))}
                . Nhắn hỏi thăm có thể giúp các bạn quay lại.
              </span>
            </Card>
          )}
          <Card className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="text-xs text-ink-muted">
                <tr>
                  <th className="p-2 font-medium">Học viên</th>
                  <th className="p-2 font-medium">Học gần nhất</th>
                  <th className="p-2 font-medium">
                    14 ngày{' '}
                    <InfoHint label="biểu đồ 14 ngày">
                      Số lượt hoạt động mỗi ngày trong 14 ngày qua (câu hỏi, nhiệm vụ, lượt ôn thẻ). Chấm màu
                      là hôm nay.
                    </InfoHint>
                  </th>
                  <th className="p-2 text-right font-medium">Câu (30 ngày)</th>
                  <th className="p-2 text-right font-medium">Đúng</th>
                  {roadmap && <th className="p-2 font-medium">Lộ trình</th>}
                  {roadmap && <th className="p-2 text-right font-medium">Thi thử</th>}
                  <th className="p-2 font-medium">Cần luyện</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const idleFor = idleDays(r, today);
                  return (
                    <tr key={r.user_id} className="border-t border-line align-middle">
                      <td className="p-2">
                        <Link
                          to={`/admin/nguoi-dung/${r.user_id}`}
                          className="font-medium text-brand-ink hover:underline"
                        >
                          {r.display_name || r.email}
                        </Link>
                        <div className="text-xs text-ink-muted">
                          {r.track ? `Nhánh ${r.track}` : roadmap ? 'Chưa xếp nhánh' : ''}
                        </div>
                      </td>
                      <td className="p-2 whitespace-nowrap">
                        {r.last_active ? formatDateVN(r.last_active) : '—'}
                        <div className="mt-0.5">
                          {idleFor === null ? (
                            <Badge>Chưa học</Badge>
                          ) : idleFor > IDLE_WARN ? (
                            <Badge color="yellow">
                              <IconClock size={12} /> nghỉ {idleFor} ngày
                            </Badge>
                          ) : r.current_streak > 1 ? (
                            <Badge color="coral">
                              <IconFlame size={12} /> {r.current_streak} ngày
                            </Badge>
                          ) : null}
                        </div>
                      </td>
                      <td className="p-2">
                        <Sparkline
                          values={r.spark}
                          label={`${r.spark.reduce((a, b) => a + b, 0)} lượt hoạt động trong 14 ngày`}
                        />
                      </td>
                      <td className="p-2 text-right tabular-nums">{r.answers_30d}</td>
                      <td className="p-2 text-right tabular-nums">
                        {r.answers_30d ? `${percent(r.correct_30d, r.answers_30d)}%` : '—'}
                      </td>
                      {roadmap && (
                        <td className="p-2 whitespace-nowrap tabular-nums">
                          {r.tasks_total ? (
                            <>
                              {percent(r.tasks_done, r.tasks_total)}%
                              <span className="text-xs text-ink-muted">
                                {' '}
                                ({r.tasks_done}/{r.tasks_total})
                              </span>
                            </>
                          ) : (
                            '—'
                          )}
                        </td>
                      )}
                      {roadmap && <td className="p-2 text-right tabular-nums">{r.latest_mock ?? '—'}</td>}
                      <td className="p-2">
                        {r.weakest_tag ? (
                          <span>
                            {tagLabel(course, r.weakest_tag)}
                            <span className="text-xs text-ink-muted">
                              {' '}
                              {r.weakest_correct}/{r.weakest_n}
                            </span>
                          </span>
                        ) : (
                          <span className="text-ink-faint">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  );
}
