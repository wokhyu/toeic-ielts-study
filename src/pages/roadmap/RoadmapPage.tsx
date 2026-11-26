import { Badge, Card, ProgressBar } from '../../components/ui.tsx';
import { roadmaps } from '../../content/index.ts';
import { minutesOf, tasksFor, weekCompletion } from '../../lib/roadmap.ts';
import { percent } from '../../lib/streak.ts';
import { useRoadmap, useTaskProgress } from './context.ts';
import { TaskList } from './TaskList.tsx';

const DAY_NAMES = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];

export function RoadmapPage() {
  const { program, track, preview } = useRoadmap();
  const { done } = useTaskProgress(program, !preview);
  if (!track) return null;
  const doneSet = new Set(done.keys());

  return (
    <div className="space-y-3">
      {roadmaps[program].map((w) => {
        const c = weekCompletion(w, track, doneSet);
        return (
          <details
            key={w.week}
            className="group rounded-[var(--radius-card)] bg-surface shadow-soft ring-1 ring-line"
          >
            <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3 p-4">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-soft text-sm font-semibold text-brand-ink group-open:bg-brand group-open:text-on-solid">
                {w.week}
              </span>
              <span className="font-semibold">Tuần {w.week}</span>
              <span className="text-sm text-ink-soft">{w.phase.replace(/^Giai đoạn \d: /, '')}</span>
              {w.days.some((d) => d.mock_test) && <Badge color="yellow">Thi thử</Badge>}
              <span className="ml-auto w-32">
                <ProgressBar value={percent(c.done, c.total)} />
              </span>
              <span className="text-xs text-ink-muted">
                {c.done}/{c.total}
              </span>
            </summary>
            <div className="space-y-4 border-t border-line p-4">
              <dl className="grid gap-1 text-sm sm:grid-cols-2">
                {Object.entries(w.focus).map(([k, v]) => (
                  <div key={k}>
                    <dt className="inline font-medium capitalize">{k}: </dt>
                    <dd className="inline text-ink-soft">{v}</dd>
                  </div>
                ))}
              </dl>
              {w.days.map((d) => {
                const tasks = tasksFor(w, d.day, track);
                return (
                  <Card key={d.day} variant="soft" className="!p-3">
                    <p className="mb-2 text-sm font-semibold text-ink">
                      {DAY_NAMES[d.day - 1]} · {minutesOf(tasks)} phút
                    </p>
                    <TaskList tasks={tasks} done={done} />
                  </Card>
                );
              })}
            </div>
          </details>
        );
      })}
    </div>
  );
}
