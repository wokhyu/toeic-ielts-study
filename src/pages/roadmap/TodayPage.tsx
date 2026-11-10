import { useState } from 'react';
import { Badge, Button, Card, ErrorBox, ProgressBar, Spinner } from '../../components/ui.tsx';
import { roadmaps } from '../../content/index.ts';
import { useAuth } from '../../lib/auth-context.ts';
import { formatDateVN, nextMonday, todayVN } from '../../lib/dates.ts';
import { minutesOf, positionOn, tasksFor, weekCompletion } from '../../lib/roadmap.ts';
import { percent } from '../../lib/streak.ts';
import { db, errorMessage } from '../../lib/supabase.ts';
import { useRoadmap, useTaskProgress } from './context.ts';
import { TaskList } from './TaskList.tsx';

const DAY_NAMES = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];

export function TodayPage() {
  const { program, track, startDate: savedStart, preview } = useRoadmap();
  const { refresh } = useAuth();
  const { done, toggle, error, loading } = useTaskProgress(program, !preview);
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
      <Card>
        <p className="text-sm">Chọn ngày bắt đầu lộ trình (nên là thứ Hai).</p>
        <Button className="mt-3" onClick={() => void setStart(nextMonday(today))}>
          Bắt đầu từ thứ Hai {formatDateVN(nextMonday(today))}
        </Button>
        {saveError && <ErrorBox message={saveError} />}
      </Card>
    );
  }

  const w = roadmaps[program][week - 1];
  const tasks = day <= 6 ? tasksFor(w, day, track) : [];
  const completion = weekCompletion(w, track, new Set(done.keys()));

  return (
    <div className="space-y-4">
      {pos?.status === 'not_started' && (
        <Card>Lộ trình bắt đầu ngày {formatDateVN(startDate)}. Bạn có thể xem trước nhiệm vụ tuần 1.</Card>
      )}
      {pos?.status === 'finished' && (
        <Card>Bạn đã đi hết 12 tuần. Xem lại các tuần bên dưới hoặc ở tab Lộ trình.</Card>
      )}

      <Card>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="rounded-md border border-slate-300 px-2 py-1 text-sm"
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
              <button
                key={name}
                type="button"
                onClick={() => setDay(i + 1)}
                className={`rounded-md px-2.5 py-1 text-sm ${day === i + 1 ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'} ${pos?.week === week && pos.day === i + 1 ? 'ring-2 ring-amber-400' : ''}`}
              >
                {name}
              </button>
            ))}
          </div>
        </div>
        <p className="mt-3 text-sm text-slate-600">
          {w.phase} · Tuần {week}: {completion.done}/{completion.total} nhiệm vụ
        </p>
        <div className="mt-2">
          <ProgressBar value={percent(completion.done, completion.total)} />
        </div>
        <dl className="mt-3 grid gap-1 text-sm sm:grid-cols-2">
          {Object.entries(w.focus).map(([k, v]) => (
            <div key={k}>
              <dt className="inline font-medium capitalize text-slate-700">{k}: </dt>
              <dd className="inline text-slate-600">{v}</dd>
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
          <p className="text-sm text-slate-600">Chủ nhật nghỉ. Nghỉ ngơi cũng là một phần của lộ trình.</p>
        ) : (
          <TaskList tasks={tasks} done={done} onToggle={preview ? undefined : (id) => void toggle(id)} />
        )}
        {day === 6 && (
          <p className="mt-3 text-xs text-slate-500">Thứ 7 là buổi học nhóm, có thể bỏ qua nếu bận.</p>
        )}
        {error && <ErrorBox message={error} />}
      </Card>
    </div>
  );
}
