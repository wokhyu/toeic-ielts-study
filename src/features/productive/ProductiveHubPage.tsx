import { useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { IconMic, IconPencil, IconUsers } from '../../components/icons.tsx';
import { buttonClass } from '../../components/styles.ts';
import { Badge, Card, Chip, EmptyState, ErrorBox, Spinner } from '../../components/ui.tsx';
import { speakingSets, writingPrompts } from '../../content/index.ts';
import { formatDateVN, todayVN } from '../../lib/dates.ts';
import { formatBand } from '../../lib/ielts.ts';
import { positionOn } from '../../lib/roadmap.ts';
import { useAsync } from '../../lib/useAsync.ts';
import { useRoadmap } from '../../pages/roadmap/context.ts';
import { IELTS_BASE, listSubmissions, promptTitle, type SubmissionSummary } from './data.ts';

const TABS = [
  { id: 'viet', label: 'Đề Writing' },
  { id: 'noi', label: 'Đề Speaking' },
  { id: 'cua-toi', label: 'Bài của tôi' },
  { id: 'cham-cheo', label: 'Chấm chéo' },
] as const;
type TabId = (typeof TABS)[number]['id'];

/** IELTS Writing and Speaking: prompts by week, the learner's own work, and classmates' work to review. */
export function ProductiveHubPage() {
  const [params, setParams] = useSearchParams();
  const tab = (TABS.find((t) => t.id === params.get('tab'))?.id ?? 'viet') as TabId;
  const reviewTask = params.get('nv');
  const { startDate } = useRoadmap();
  const week = startDate ? positionOn(startDate, todayVN()).week : 1;

  const load = useCallback(async () => {
    const [mine, others] = await Promise.all([listSubmissions('mine'), listSubmissions('others')]);
    return { mine, others };
  }, []);
  const { data, loading, error } = useAsync(load);
  const waiting = (data?.others ?? []).filter((s) => !s.reviewed_by_me).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Chip
            key={t.id}
            active={tab === t.id}
            onClick={() =>
              setParams((p) => {
                const next = new URLSearchParams(p);
                next.set('tab', t.id);
                return next;
              })
            }
          >
            {t.label}
            {t.id === 'cham-cheo' && waiting > 0 && <span className="ml-1 tabular-nums">({waiting})</span>}
          </Chip>
        ))}
      </div>

      {tab === 'viet' && <WritingPrompts week={week} mine={data?.mine ?? []} />}
      {tab === 'noi' && <SpeakingSets week={week} mine={data?.mine ?? []} />}
      {(tab === 'cua-toi' || tab === 'cham-cheo') &&
        (loading ? (
          <Spinner />
        ) : error ? (
          <ErrorBox message={error} />
        ) : tab === 'cua-toi' ? (
          <SubmissionList
            rows={data?.mine ?? []}
            empty="Bạn chưa nộp bài nào. Chọn một đề Writing hoặc Speaking để bắt đầu."
          />
        ) : (
          <>
            <Card variant="soft" className="text-sm text-ink-soft">
              Bài bạn cùng khóa đã chia sẻ. Chấm theo 4 tiêu chí IELTS và để lại ít nhất một nhận xét cụ thể:
              chỉ ra một điểm làm tốt và một điểm nên sửa.
            </Card>
            <SubmissionList
              rows={[...(data?.others ?? [])].sort(
                (a, b) => Number(a.reviewed_by_me) - Number(b.reviewed_by_me),
              )}
              reviewTask={reviewTask}
              showAuthor
              empty="Chưa có bài nào được chia sẻ. Khi bạn cùng khóa nộp bài và bật chia sẻ, bài sẽ hiện ở đây."
            />
          </>
        ))}
    </div>
  );
}

function WeekHeading({ week, current }: { week: number; current: number }) {
  return (
    <h2 className="mt-2 flex items-center gap-2 text-sm font-semibold text-ink">
      Tuần {week}
      {week === current && <Badge color="coral">Tuần này</Badge>}
    </h2>
  );
}

function WritingPrompts({ week, mine }: { week: number; mine: SubmissionSummary[] }) {
  const done = new Set(mine.filter((s) => s.kind === 'writing').map((s) => s.prompt_id));
  const weeks = [...new Set(writingPrompts.map((p) => p.week))];
  // This week first, then the rest in order.
  const order = [week, ...weeks.filter((w) => w !== week)];
  return (
    <div className="space-y-3">
      {order.map((w) => (
        <section key={w} className="space-y-2">
          <WeekHeading week={w} current={week} />
          <div className="grid gap-3 md:grid-cols-2">
            {writingPrompts
              .filter((p) => p.week === w)
              .map((p) => (
                <Card key={p.id} className="flex flex-col gap-2">
                  <div className="flex flex-wrap gap-1">
                    <Badge color={p.task === 1 ? 'lilac' : 'coral'}>Task {p.task}</Badge>
                    <Badge>{p.minutes} phút</Badge>
                    <Badge>≥ {p.min_words} từ</Badge>
                    {done.has(p.id) && <Badge color="green">Đã nộp</Badge>}
                  </div>
                  <p className="font-medium text-ink">{p.title_vi}</p>
                  <Link
                    to={`${IELTS_BASE}/viet/${p.id}`}
                    className={`${buttonClass('soft', 'sm')} mt-auto self-start`}
                  >
                    <IconPencil size={14} /> Viết bài
                  </Link>
                </Card>
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function SpeakingSets({ week, mine }: { week: number; mine: SubmissionSummary[] }) {
  const done = new Set(mine.filter((s) => s.kind === 'speaking').map((s) => s.prompt_id));
  const order = [...speakingSets].sort((a, b) =>
    a.week === week ? -1 : b.week === week ? 1 : a.week - b.week,
  );
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {order.map((s) => (
        <Card key={s.id} className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-1">
            <Badge>Tuần {s.week}</Badge>
            {s.week === week && <Badge color="coral">Tuần này</Badge>}
            {done.has(s.id) && <Badge color="green">Đã ghi âm</Badge>}
          </div>
          <p className="font-medium text-ink">{s.topic_vi}</p>
          <p className="text-sm text-ink-soft">Part 2: {s.part2.cue}</p>
          <Link
            to={`${IELTS_BASE}/noi/${s.id}`}
            className={`${buttonClass('soft', 'sm')} mt-auto self-start`}
          >
            <IconMic size={14} /> Luyện nói
          </Link>
        </Card>
      ))}
    </div>
  );
}

function SubmissionList({
  rows,
  empty,
  showAuthor,
  reviewTask,
}: {
  rows: SubmissionSummary[];
  empty: string;
  showAuthor?: boolean;
  reviewTask?: string | null;
}) {
  if (rows.length === 0) return <EmptyState title="Chưa có bài nào">{empty}</EmptyState>;
  return (
    <ul className="space-y-2">
      {rows.map((s) => (
        <li key={s.id}>
          <Link
            to={`${IELTS_BASE}/bai/${s.id}${reviewTask ? `?nv=${encodeURIComponent(reviewTask)}` : ''}`}
            className="flex flex-wrap items-center gap-3 rounded-2xl bg-surface p-3 ring-1 ring-line transition hover:ring-brand"
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-soft text-brand-ink">
              {s.kind === 'writing' ? <IconPencil size={16} /> : <IconMic size={16} />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium text-ink">{promptTitle(s.kind, s.prompt_id)}</span>
              <span className="text-xs text-ink-muted">
                {showAuthor && `${s.author} · `}
                {formatDateVN(s.created_at.slice(0, 10))}
                {s.kind === 'writing' ? ` · ${s.word_count} từ` : ''}
                {!showAuthor && (s.shared ? ' · đã chia sẻ' : ' · chỉ mình bạn')}
              </span>
            </span>
            <span className="flex items-center gap-1 text-xs text-ink-soft">
              <IconUsers size={14} /> {s.reviews}
              {s.peer_overall !== null && <Badge color="blue">band {formatBand(s.peer_overall)}</Badge>}
              {showAuthor &&
                (s.reviewed_by_me ? (
                  <Badge color="green">Đã chấm</Badge>
                ) : (
                  <Badge color="yellow">Chờ chấm</Badge>
                ))}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
