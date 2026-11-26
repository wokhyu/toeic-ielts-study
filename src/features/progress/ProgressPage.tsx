import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { Mascot } from '../../components/art/Mascot.tsx';
import { AccuracyBars, type AccuracyRow } from '../../components/charts/AccuracyBars.tsx';
import { Heatmap } from '../../components/charts/Heatmap.tsx';
import { ScoreTrend } from '../../components/charts/ScoreTrend.tsx';
import { Confetti } from '../../components/effects.tsx';
import { IconCalendar, IconClock, IconFlame, IconRepeat, IconTarget } from '../../components/icons.tsx';
import { buttonClass } from '../../components/styles.ts';
import { Card, Chip, EmptyState, ErrorBox, InfoHint, Spinner, StatTile } from '../../components/ui.tsx';
import { badgesFor } from '../../content/badges.ts';
import { tagLabel } from '../../content/bank.ts';
import { formatDateVN, toDateVN } from '../../lib/dates.ts';
import { targetScore } from '../../lib/scores.ts';
import { formatDuration, weakest } from '../../lib/stats.ts';
import { percent } from '../../lib/streak.ts';
import { db } from '../../lib/supabase.ts';
import { bankBase, type CourseId } from '../../lib/types.ts';
import { unwrap, useAsync } from '../../lib/useAsync.ts';
import type { Achievement, Progress } from './data.ts';

type Window = 'all' | '30d';

/**
 * The "Tiến bộ" tab: study calendar, accuracy by Part and by grammar point with
 * honest uncertainty, the weakest points with a direct link to practise them,
 * mock test trend and badges. Admins reuse it for any learner via `userId`.
 */
export function ProgressPage({
  course,
  userId,
  track,
}: {
  course: CourseId;
  /** Another learner's id (admin view). Omit for the signed-in learner. */
  userId?: string;
  track?: string | null;
}) {
  const own = !userId;
  const [win, setWin] = useState<Window>('30d');

  const load = useCallback(async () => {
    // Award newly earned badges first, so the summary already lists them.
    const fresh = own
      ? (unwrap(await db().rpc('learner_achievements', { p_course: course })) as Achievement[]).filter(
          (a) => a.is_new,
        )
      : [];
    const progress = unwrap(
      await db().rpc('learner_progress', { p_course: course, p_user: userId ?? null }),
    ) as Progress;
    return { progress, fresh };
  }, [course, userId, own]);
  const { data, loading, error } = useAsync(load);

  if (loading) return <Spinner label="Bé Cú đang tổng hợp kết quả…" />;
  if (error) return <ErrorBox message={error} />;
  if (!data) return null;
  const { progress: p, fresh } = data;
  const t = p.totals;
  const roadmap = course !== 'on-tap-11';
  const base = bankBase(course);

  const pick = (r: { n: number; correct: number; n_30d: number; correct_30d: number }) =>
    win === '30d' ? { n: r.n_30d, correct: r.correct_30d } : { n: r.n, correct: r.correct };

  const tagRows = p.by_tag
    .map((r) => ({ key: r.tag, label: tagLabel(course, r.tag), ...pick(r) }))
    .filter((r) => r.n > 0);
  const chapterRows = p.by_chapter
    .map((r) => ({ key: String(r.id), label: r.name, ...pick(r) }))
    .filter((r) => r.n > 0);
  // Tags are finer than Parts; on-tap-11 questions have none, so fall back to chapters.
  const weak = weakest(tagRows.length > 0 ? tagRows : chapterRows);
  const practiceLink = (row: AccuracyRow) =>
    tagRows.length > 0 ? (
      <Link to={`${base}/the/${row.key}`} className={buttonClass('soft', 'sm')}>
        Luyện phần này
      </Link>
    ) : undefined;

  const answers = win === '30d' ? t.answers_30d : t.answers;
  const correct = win === '30d' ? t.correct_30d : t.correct;
  const empty = t.answers === 0 && t.tasks === 0 && t.cards === 0;
  const earned = new Map(p.badges.map((b) => [b.id, b.awarded_at]));
  const freshIds = new Set(fresh.map((f) => f.badge_id));

  return (
    <div className="space-y-5">
      {fresh.length > 0 && (
        <Card variant="hero" className="relative flex items-center gap-4 overflow-hidden">
          <Confetti fire={fresh.length} pieces={28} />
          <Mascot mood="cheer" size={72} decorative />
          <div>
            <p className="font-semibold text-ink">Bạn vừa nhận {fresh.length} huy hiệu mới!</p>
            <p className="text-sm text-ink-soft">
              {badgesFor(course)
                .filter((b) => freshIds.has(b.id))
                .map((b) => `${b.icon} ${b.name}`)
                .join(' · ')}
            </p>
          </div>
        </Card>
      )}

      {empty && own && (
        <EmptyState title="Chưa có dữ liệu để tổng hợp" mood="happy">
          Làm vài câu luyện tập, tích một nhiệm vụ hoặc ôn flashcard, rồi quay lại đây để xem biểu đồ tiến bộ.
        </EmptyState>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Chuỗi ngày học"
          value={`${p.streak.current_streak} ngày`}
          note={`Dài nhất: ${p.streak.longest_streak} ngày`}
          icon={<IconFlame />}
          tone="accent"
        />
        <StatTile
          label="Số ngày có học"
          value={p.streak.active_days}
          note={p.streak.last_day ? `Gần nhất ${formatDateVN(p.streak.last_day)}` : 'Chưa có'}
          icon={<IconCalendar />}
          tone="butter"
        />
        <StatTile
          label={win === '30d' ? 'Độ chính xác 30 ngày' : 'Độ chính xác'}
          value={answers > 0 ? `${percent(correct, answers)}%` : '—'}
          note={`${correct}/${answers} câu đúng`}
          icon={<IconTarget />}
          tone="brand"
        />
        <StatTile
          label="Thời gian mỗi câu"
          value={formatDuration(t.median_time_ms)}
          note="trung vị, khi luyện tập"
          icon={<IconClock />}
          tone="lilac"
        />
      </div>

      {own && t.due_reviews > 0 && (
        <Card variant="soft" className="flex flex-wrap items-center gap-3">
          <IconRepeat className="text-accent-ink" />
          <p className="mr-auto text-sm">
            Có <b>{t.due_reviews}</b> câu từng làm sai đã đến hạn ôn lại hôm nay.
          </p>
          <Link to={`${base}/on-lai`} className={buttonClass('accent', 'sm')}>
            Ôn ngay
          </Link>
        </Card>
      )}

      <Card>
        <div className="mb-3 flex items-center gap-2">
          <h2 className="font-semibold text-ink">Lịch học</h2>
          <InfoHint label="lịch học">
            Mỗi ô là một ngày, mỗi cột là một tuần (thứ Hai ở trên cùng). Ô càng đậm thì hôm đó bạn làm càng
            nhiều: câu hỏi, nhiệm vụ và lượt ôn thẻ đều được tính. Ô viền cam là hôm nay.
          </InfoHint>
        </div>
        <Heatmap data={p.heatmap} today={p.today} />
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-ink-soft">Tính độ chính xác trong:</span>
        <Chip active={win === '30d'} onClick={() => setWin('30d')}>
          30 ngày qua
        </Chip>
        <Chip active={win === 'all'} onClick={() => setWin('all')}>
          Từ trước tới nay
        </Chip>
      </div>

      {weak.length > 0 && (
        <Card>
          <div className="mb-3 flex items-center gap-2">
            <h2 className="font-semibold text-ink">Cần luyện thêm</h2>
            <InfoHint label="cách chọn phần cần luyện">
              Chỉ xét các phần bạn đã làm từ 5 câu trở lên và đúng dưới 80%. Phần nào ngay cả ước lượng lạc
              quan nhất (đầu trên của khoảng tin cậy) vẫn thấp thì xếp lên trước.
            </InfoHint>
          </div>
          <AccuracyBars rows={weak.map((r) => ({ ...r, action: own ? practiceLink(r) : undefined }))} />
        </Card>
      )}

      {chapterRows.length > 0 && (
        <Card>
          <div className="mb-3 flex items-center gap-2">
            <h2 className="font-semibold text-ink">
              {roadmap ? 'Độ chính xác theo Part' : 'Độ chính xác theo chương'}
            </h2>
            <InfoHint label="khoảng tin cậy">
              Thanh màu là tỉ lệ câu đúng. Vạch mảnh màu tối là khoảng tin cậy 95%: trình độ thật của bạn
              nhiều khả năng nằm trong khoảng này. Làm ít câu thì khoảng rộng, làm nhiều thì khoảng hẹp lại.
              Dưới 5 câu thì chưa vẽ.
            </InfoHint>
          </div>
          <AccuracyBars rows={chapterRows} />
        </Card>
      )}

      {tagRows.length > 0 && (
        <Card>
          <h2 className="mb-3 font-semibold text-ink">Độ chính xác theo chủ điểm</h2>
          <AccuracyBars rows={[...tagRows].sort((a, b) => b.n - a.n).slice(0, 14)} />
        </Card>
      )}

      {roadmap && p.mock_scores.length > 0 && (
        <Card>
          <h2 className="mb-3 font-semibold text-ink">Điểm thi thử</h2>
          <ScoreTrend
            program={course}
            rows={p.mock_scores}
            target={targetScore(course, track ?? null)}
            height={240}
          />
        </Card>
      )}

      <Card>
        <h2 className="mb-3 font-semibold text-ink">
          Huy hiệu · {[...earned.keys()].length}/{badgesFor(course).length}
        </h2>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {badgesFor(course).map((b) => {
            const at = earned.get(b.id);
            return (
              <li
                key={b.id}
                className={`flex flex-col items-center rounded-2xl p-3 text-center ring-1 ${
                  at ? 'bg-butter-soft ring-butter/50' : 'bg-subtle ring-line'
                } ${freshIds.has(b.id) ? 'animate-pop' : ''}`}
              >
                <span className={`text-3xl ${at ? '' : 'opacity-30 grayscale'}`} aria-hidden="true">
                  {b.icon}
                </span>
                <span className={`mt-1 text-sm font-semibold ${at ? 'text-ink' : 'text-ink-muted'}`}>
                  {b.name}
                </span>
                <span className="mt-0.5 text-xs text-ink-muted">{b.description}</span>
                <span className="mt-1 text-xs font-medium text-ink-soft">
                  {at ? `Đạt ngày ${formatDateVN(toDateVN(at))}` : 'Chưa đạt'}
                </span>
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}
