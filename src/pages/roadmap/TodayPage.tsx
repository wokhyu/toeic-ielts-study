import { useState } from 'react';
import { Mascot } from '../../components/art/Mascot.tsx';
import {
  Badge,
  Button,
  Card,
  Chip,
  EmptyState,
  ErrorBox,
  ProgressRing,
  selectClass,
  Spinner,
} from '../../components/ui.tsx';
import { roadmaps } from '../../content/index.ts';
import { useAuth } from '../../lib/auth-context.ts';
import { formatDateVN, nextMonday, todayVN } from '../../lib/dates.ts';
import { minutesOf, positionOn, tasksFor, weekCompletion } from '../../lib/roadmap.ts';
import { percent } from '../../lib/streak.ts';
import { db, errorMessage } from '../../lib/supabase.ts';
import { useRoadmap, useTaskProgress } from './context.ts';
import { TaskList } from './TaskList.tsx';
import { TodaySuggestions } from './TodaySuggestions.tsx';
import { useTaskLinks } from './useTaskLinks.ts';

const DAY_NAMES = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];

export function TodayPage() {
  const { program, track, startDate: savedStart, preview } = useRoadmap();
  const { refresh } = useAuth();
  const { done, toggle, error, loading } = useTaskProgress(program, !preview);
  const links = useTaskLinks(program, !preview);
  const today = todayVN();
  const startDate = savedStart ?? (preview ? nextMonday(today) : null);
  const pos = startDate ? positionOn(startDate, today) : null;
  const [week, setWeek] = useState(pos?.week ?? 1);
  const [day, setDay] = useState(pos && pos.status === 'in_progress' ? pos.day : 1);
  const [saveError, setSaveError] = useState<string | null>(null);

  if (!track) return null;
  if (loading) return <Spinner />;

  const setStart = async (date: string) => {
    const { error: err } = await db()
      .from('enrollments')
      .update({ start_date: date })
      .eq('course_id', program);
    if (err) setSaveError(errorMessage(err));
    await refresh();
  };

  if (!startDate) {
    return (
      <EmptyState
        title="Sẵn sàng bắt đầu chưa?"
        mood="cheer"
        action={
          <Button onClick={() => void setStart(nextMonday(today))}>
            Bắt đầu từ thứ Hai {formatDateVN(nextMonday(today))}
          </Button>
        }
      >
        Chọn ngày bắt đầu lộ trình 12 tuần, nên là một ngày thứ Hai.
        {saveError && <ErrorBox message={saveError} />}
      </EmptyState>
    );
  }

  const w = roadmaps[program][week - 1];
  const tasks = day <= 6 ? tasksFor(w, day, track) : [];
  const completion = weekCompletion(w, track, new Set(done.keys()));

  return (
    <div className="space-y-4">
      {!preview && <TodaySuggestions program={program} currentWeek={pos?.week ?? 1} today={today} />}
      {pos?.status === 'not_started' && (
        <Card variant="hero" className="flex items-center gap-3">
          <Mascot mood="happy" size={56} decorative />
          <p className="text-sm">
            Lộ trình bắt đầu ngày <b>{formatDateVN(startDate)}</b>. Trong lúc chờ, bạn có thể xem trước nhiệm
            vụ tuần 1.
          </p>
        </Card>
      )}
      {pos?.status === 'finished' && (
        <Card variant="hero" className="flex items-center gap-3">
          <Mascot mood="cheer" size={56} decorative />
          <p className="text-sm">
            Bạn đã đi hết 12 tuần, giỏi quá! Xem lại các tuần bên dưới hoặc ở tab Lộ trình.
          </p>
        </Card>
      )}

      <Card>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className={selectClass}
            aria-label="Chọn tuần"
            value={week}
            onChange={(e) => setWeek(Number(e.target.value))}
          >
            {roadmaps[program].map((x) => (
              <option key={x.week} value={x.week}>
                Tuần {x.week}
              </option>
            ))}
          </select>
          <div className="flex flex-wrap gap-1">
            {DAY_NAMES.map((name, i) => (
              <Chip
                key={name}
                active={day === i + 1}
                onClick={() => setDay(i + 1)}
                className={pos?.week === week && pos.day === i + 1 ? 'ring-2 ring-accent' : ''}
                title={pos?.week === week && pos.day === i + 1 ? 'Hôm nay' : undefined}
              >
                {name}
              </Chip>
            ))}
          </div>
        </div>
        <div className="mt-4 flex items-center gap-4">
          <ProgressRing value={percent(completion.done, completion.total)} label={`Tiến độ tuần ${week}`} />
          <div>
            <p className="font-semibold text-ink">
              Tuần {week} · {w.phase}
            </p>
            <p className="text-sm text-ink-soft">
              Đã xong {completion.done}/{completion.total} nhiệm vụ
            </p>
          </div>
        </div>
        <dl className="mt-3 grid gap-1 text-sm sm:grid-cols-2">
          {Object.entries(w.focus).map(([k, v]) => (
            <div key={k}>
              <dt className="inline font-medium capitalize text-ink-soft">{k}: </dt>
              <dd className="inline text-ink-soft">{v}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">
            {DAY_NAMES[day - 1]}, tuần {week}
          </h2>
          {day <= 6 && <Badge>{minutesOf(tasks)} phút</Badge>}
        </div>
        {day === 7 ? (
          <div className="flex items-center gap-3 rounded-2xl bg-subtle p-4">
            <Mascot mood="sleepy" size={56} decorative />
            <p className="text-sm text-ink-soft">Chủ nhật nghỉ. Nghỉ ngơi cũng là một phần của lộ trình.</p>
          </div>
        ) : (
          <TaskList
            tasks={tasks}
            done={done}
            onToggle={preview ? undefined : (id) => void toggle(id)}
            links={links}
          />
        )}
        {day === 6 && (
          <p className="mt-3 text-xs text-ink-muted">Thứ 7 là buổi học nhóm, có thể bỏ qua nếu bận.</p>
        )}
        {error && <ErrorBox message={error} />}
      </Card>
    </div>
  );
}
