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
          <details key={w.week} className="group rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
            <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3 p-4">
              <span className="font-semibold">Tuần {w.week}</span>
              <span className="text-sm text-slate-600">{w.phase.replace(/^Giai đoạn \d: /, '')}</span>
              {w.days.some((d) => d.mock_test) && <Badge color="yellow">Thi thử</Badge>}
              <span className="ml-auto w-32">
                <ProgressBar value={percent(c.done, c.total)} />
              </span>
              <span className="text-xs text-slate-500">
                {c.done}/{c.total}
              </span>
            </summary>
            <div className="space-y-4 border-t border-slate-100 p-4">
              <dl className="grid gap-1 text-sm sm:grid-cols-2">
                {Object.entries(w.focus).map(([k, v]) => (
                  <div key={k}>
                    <dt className="inline font-medium capitalize">{k}: </dt>
                    <dd className="inline text-slate-600">{v}</dd>
                  </div>
                ))}
              </dl>
              {w.days.map((d) => {
                const tasks = tasksFor(w, d.day, track);
                return (
                  <Card key={d.day} className="!p-3">
                    <p className="text-sm font-medium">
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
