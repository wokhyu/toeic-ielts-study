import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { DailyActivity, type DailyRow } from '../../components/charts/DailyActivity.tsx';
import { Heatmap } from '../../components/charts/Heatmap.tsx';
import { IconCheck, IconClock, IconFlame, IconUsers } from '../../components/icons.tsx';
import { Card, Chip, ErrorBox, InfoHint, Notice, Spinner, StatTile } from '../../components/ui.tsx';
import { addDays, todayVN } from '../../lib/dates.ts';
import { percent } from '../../lib/streak.ts';
import { db } from '../../lib/supabase.ts';
import { unwrap, useAsync } from '../../lib/useAsync.ts';
import { ADMIN_COURSES, useAdminCourse } from './useAdminCourse.ts';

interface Overview {
  from: string;
  to: string;
  kpis: {
    active_7d: number;
    active_30d: number;
    active_range: number;
    answers: number;
    correct: number;
    tasks: number;
    cards: number;
    study_minutes: number;
    pending: number;
  };
  daily: (DailyRow & { learners: number })[];
  funnel: { requested: number; approved: number; started: number; active_7d: number };
  tracks: { A: number; B: number; C: number; none: number };
}

const RANGES = [7, 30, 90] as const;

const TRACKS = [
  ['A', 'Nhánh A · nền tảng'],
  ['B', 'Nhánh B · trung cấp'],
  ['C', 'Nhánh C · nâng cao'],
  ['none', 'Chưa xếp nhánh'],
] as const;

export function AdminOverviewPage() {
  const [course, setCourse] = useAdminCourse(true);
  const [days, setDays] = useState<(typeof RANGES)[number]>(30);
  const load = useCallback(async () => {
    const to = todayVN();
    return unwrap(
      await db().rpc('admin_overview', { p_course: course, p_from: addDays(to, -(days - 1)), p_to: to }),
    ) as Overview;
  }, [course, days]);
  const { data, loading, error } = useAsync(load);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <Chip active={course === null} onClick={() => setCourse(null)}>
          Tất cả khóa
        </Chip>
        {ADMIN_COURSES.map((c) => (
          <Chip key={c.id} active={course === c.id} onClick={() => setCourse(c.id)}>
            {c.label}
          </Chip>
        ))}
        <span className="mx-1 h-5 w-px bg-line" aria-hidden="true" />
        {RANGES.map((r) => (
          <Chip key={r} active={days === r} onClick={() => setDays(r)}>
            {r} ngày
          </Chip>
        ))}
      </div>

      {loading ? (
        <Spinner label="Đang tổng hợp số liệu cả lớp…" />
      ) : error ? (
        <ErrorBox message={error} />
      ) : data ? (
        <OverviewBody data={data} days={days} />
      ) : null}
    </div>
  );
}

function Meter({
  label,
  value,
  total,
  muted,
}: {
  label: string;
  value: number;
  total: number;
  muted?: boolean;
}) {
  return (
    <li>
      <div className="flex justify-between text-sm">
        <span className="text-ink">{label}</span>
        <span className="text-ink-soft tabular-nums">
          <b className="text-ink">{value}</b> · {percent(value, total)}%
        </span>
      </div>
      <div className="mt-1 h-3 rounded-full bg-muted">
        <div
          className={`h-3 rounded-full ${muted ? 'bg-line-strong' : 'bg-brand'}`}
          style={{ width: `${total > 0 ? (value / total) * 100 : 0}%` }}
        />
      </div>
    </li>
  );
}

function OverviewBody({ data, days }: { data: Overview; days: number }) {
  const k = data.kpis;
  const funnel = [
    { label: 'Gửi yêu cầu', value: data.funnel.requested },
    { label: 'Được duyệt', value: data.funnel.approved },
    { label: 'Đã bắt đầu học', value: data.funnel.started },
    { label: 'Học trong 7 ngày qua', value: data.funnel.active_7d },
  ];
  const trackTotal = data.tracks.A + data.tracks.B + data.tracks.C + data.tracks.none;

  return (
    <>
      {k.pending > 0 && (
        <Notice>
          Có <b>{k.pending}</b> yêu cầu vào khóa đang chờ duyệt.{' '}
          <Link to="/admin/tai-khoan" className="font-medium underline">
            Duyệt ngay
          </Link>
        </Notice>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Học viên hoạt động"
          value={`${k.active_7d} / ${k.active_30d}`}
          note="trong 7 / 30 ngày gần nhất"
          icon={<IconUsers />}
          tone="brand"
        />
        <StatTile
          label={`Câu đã làm (${days} ngày)`}
          value={k.answers}
          note={k.answers > 0 ? `đúng ${percent(k.correct, k.answers)}%` : 'chưa có'}
          icon={<IconCheck />}
          tone="mint"
        />
        <StatTile
          label="Nhiệm vụ · lượt ôn thẻ"
          value={`${k.tasks} · ${k.cards}`}
          note={`trong ${days} ngày`}
          icon={<IconFlame />}
          tone="accent"
        />
        <StatTile
          label="Thời gian học ước tính"
          value={
            k.study_minutes >= 120 ? `${Math.round(k.study_minutes / 60)} giờ` : `${k.study_minutes} phút`
          }
          note={`trong ${days} ngày`}
          icon={<IconClock />}
          tone="lilac"
        />
      </div>

      <Card>
        <div className="mb-3 flex items-center gap-2">
          <h2 className="font-semibold text-ink">Hoạt động theo ngày</h2>
          <InfoHint label="hoạt động theo ngày">
            Mỗi cột là một ngày (giờ Việt Nam), chồng ba phần: số câu đã trả lời, số nhiệm vụ lộ trình đã tích
            và số lượt ôn flashcard. Không tính tài khoản admin. Thời gian học ước tính = thời gian làm câu
            hỏi + số phút ghi trên các nhiệm vụ đã tích.
          </InfoHint>
        </div>
        <DailyActivity rows={data.daily} from={data.from} to={data.to} />
      </Card>

      <div className="grid gap-5 md:grid-cols-2">
        <Card>
          <div className="mb-3 flex items-center gap-2">
            <h2 className="font-semibold text-ink">Phễu học viên</h2>
            <InfoHint label="phễu học viên">
              Từ lúc gửi yêu cầu đến lúc học đều; mỗi bậc là số người còn lại, phần trăm tính trên số người
              gửi yêu cầu. Bậc tụt mạnh là chỗ cần hỗ trợ, ví dụ duyệt chậm hoặc vào khóa rồi chưa bắt đầu.
            </InfoHint>
          </div>
          <ol className="space-y-2.5">
            {funnel.map((f) => (
              <Meter key={f.label} label={f.label} value={f.value} total={funnel[0].value} />
            ))}
          </ol>
        </Card>
        <Card>
          <h2 className="mb-3 font-semibold text-ink">Phân bố nhánh</h2>
          {trackTotal === 0 ? (
            <p className="text-sm text-ink-muted">Chưa có học viên được duyệt.</p>
          ) : (
            <ul className="space-y-2.5">
              {TRACKS.map(([key, label]) => (
                <Meter
                  key={key}
                  label={label}
                  value={data.tracks[key]}
                  total={trackTotal}
                  muted={key === 'none'}
                />
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card>
        <h2 className="mb-3 font-semibold text-ink">Lịch học của cả lớp</h2>
        <Heatmap data={data.daily} today={data.to} days={Math.max(days, 63)} />
      </Card>
    </>
  );
}
