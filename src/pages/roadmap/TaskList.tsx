import { Badge } from '../../components/ui.tsx';
import type { Task } from '../../content/schema.ts';

const SKILL: Record<Task['skill'], string> = {
  listening: 'Nghe',
  reading: 'Đọc',
  writing: 'Viết',
  speaking: 'Nói',
  grammar: 'Ngữ pháp',
  vocab: 'Từ vựng',
  mock: 'Kiểm tra',
};

export function TaskList({
  tasks,
  done,
  onToggle,
}: {
  tasks: Task[];
  done?: Map<string, string>;
  onToggle?: (taskId: string) => void;
}) {
  return (
    <ul className="divide-y divide-slate-100">
      {tasks.map((t) => {
        const checked = done?.has(t.id) ?? false;
        return (
          <li key={t.id} className="flex items-start gap-3 py-2.5">
            {onToggle ? (
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 accent-indigo-600"
                checked={checked}
                onChange={() => onToggle(t.id)}
                aria-label={t.title}
              />
            ) : (
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-slate-300" />
            )}
            <div className="flex-1">
              <p className={`text-sm ${checked ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                {t.title}
              </p>
              <div className="mt-1 flex flex-wrap gap-1">
                <Badge>{SKILL[t.skill]}</Badge>
                <Badge>{t.minutes} phút</Badge>
                {t.group_activity && <Badge color="blue">Nhóm</Badge>}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
