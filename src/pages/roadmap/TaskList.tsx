import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Confetti } from '../../components/effects.tsx';
import { IconArrowRight, IconCheck, IconUsers } from '../../components/icons.tsx';
import { buttonClass } from '../../components/styles.ts';
import { Badge, type BadgeColor } from '../../components/ui.tsx';
import type { Task } from '../../content/schema.ts';
import { canPractise } from '../../lib/roadmap.ts';
import type { TaskLinks } from './useTaskLinks.ts';

const SKILL: Record<Task['skill'], { label: string; color: BadgeColor }> = {
  listening: { label: 'Nghe', color: 'blue' },
  reading: { label: 'Đọc', color: 'lilac' },
  writing: { label: 'Viết', color: 'coral' },
  speaking: { label: 'Nói', color: 'yellow' },
  grammar: { label: 'Ngữ pháp', color: 'green' },
  vocab: { label: 'Từ vựng', color: 'gray' },
  mock: { label: 'Kiểm tra', color: 'red' },
};

export function TaskList({
  tasks,
  done,
  onToggle,
  links,
}: {
  tasks: Task[];
  done?: Map<string, string>;
  onToggle?: (taskId: string) => void;
  /** Shows "Làm ngay" on tasks linked to the question bank. */
  links?: TaskLinks;
}) {
  const [fire, setFire] = useState(0);
  return (
    <div className="relative">
      <Confetti fire={fire} />
      <ul className="space-y-2">
        {tasks.map((t) => {
          const checked = done?.has(t.id) ?? false;
          const skill = SKILL[t.skill];
          return (
            <li
              key={t.id}
              className={`flex items-start gap-3 rounded-2xl p-3 ring-1 transition ${
                checked ? 'bg-ok-soft/60 ring-ok/20' : 'bg-surface ring-line'
              }`}
            >
              {onToggle ? (
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={checked}
                  aria-label={t.title}
                  onClick={() => {
                    if (!checked) setFire((n) => n + 1);
                    onToggle(t.id);
                  }}
                  className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full ring-2 transition ${
                    checked
                      ? 'animate-pop bg-ok text-on-solid ring-ok'
                      : 'text-transparent ring-line-strong hover:ring-brand'
                  }`}
                >
                  <IconCheck size={14} strokeWidth={3} />
                </button>
              ) : (
                <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-line-strong" />
              )}
              <div className="flex-1">
                <p
                  className={`text-sm ${checked ? 'text-ink-muted line-through decoration-ok/60' : 'text-ink'}`}
                >
                  {t.title}
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  <Badge color={skill.color}>{skill.label}</Badge>
                  <Badge>{t.minutes} phút</Badge>
                  {t.group_activity && (
                    <Badge color="blue">
                      <IconUsers size={12} /> Nhóm
                    </Badge>
                  )}
                </div>
                {links && !checked && canPractise(t, links.mockWeeks) && (
                  <PractiseLink task={t} links={links} />
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function PractiseLink({ task, links }: { task: Task; links: TaskLinks }) {
  const link = task.practice!;
  const answered = link.kind === 'practice' ? (links.answered.get(task.id) ?? 0) : 0;
  const hint =
    link.kind === 'practice'
      ? answered > 0
        ? `Đã làm ${Math.min(answered, link.count)}/${link.count} câu · tự tích khi đủ`
        : `Tự tích khi làm đủ ${link.count} câu`
      : link.kind === 'exam'
        ? 'Tự tích khi nộp bài'
        : 'Đề thi thử trên web · tự tích khi nộp bài';
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
      <Link to={`${links.base}/nv/${task.id}`} className={buttonClass('soft', 'sm')}>
        {answered > 0 ? 'Làm tiếp' : 'Làm ngay'} <IconArrowRight size={14} />
      </Link>
      <span className="text-xs text-ink-muted">{hint}</span>
    </div>
  );
}
