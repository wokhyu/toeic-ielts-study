import { useState } from 'react';
import { formatDateVN } from '../../lib/dates.ts';
import { activityLevel, calendarWeeks } from '../../lib/stats.ts';

export interface DayActivity {
  day: string;
  answers: number;
  tasks: number;
  cards: number;
}

const LEVEL_CLASS = ['bg-muted', 'bg-heat-1', 'bg-heat-2', 'bg-heat-3', 'bg-heat-4'];
const ROW_LABELS = ['T2', '', 'T4', '', 'T6', '', 'CN'];

function describe(day: string, a: DayActivity | undefined) {
  if (!a) return `${formatDateVN(day)}: chưa học`;
  const parts = [
    a.answers && `${a.answers} câu`,
    a.tasks && `${a.tasks} nhiệm vụ`,
    a.cards && `${a.cards} thẻ`,
  ].filter(Boolean);
  return `${formatDateVN(day)}: ${parts.join(', ')}`;
}

/**
 * Calendar heatmap of study activity: one column per week (Monday on top),
 * one teal ramp from "none" to "a lot". Hover or focus the chart to read a day.
 */
export function Heatmap({ data, today, days = 126 }: { data: DayActivity[]; today: string; days?: number }) {
  const byDay = new Map(data.map((d) => [d.day, d]));
  const weeks = calendarWeeks(today, days);
  const [hover, setHover] = useState<string | null>(null);
  const studied = weeks.flat().filter((d) => d && byDay.has(d)).length;

  const months = weeks.map((w, i) => {
    const first = w[0];
    if (!first) return '';
    const prev = i > 0 ? weeks[i - 1][0] : null;
    return !prev || first.slice(5, 7) !== prev.slice(5, 7) ? `Th${Number(first.slice(5, 7))}` : '';
  });

  return (
    <figure className="space-y-2">
      <div className="overflow-x-auto pb-1">
        <div
          className="inline-grid gap-[3px]"
          style={{ gridTemplateColumns: `auto repeat(${weeks.length}, 14px)` }}
          role="img"
          aria-label={`Lịch học ${weeks.length} tuần gần đây: ${studied} ngày có học.`}
          onMouseLeave={() => setHover(null)}
        >
          <span />
          {months.map((m, i) => (
            <span key={i} className="h-4 text-[10px] leading-4 whitespace-nowrap text-ink-muted">
              {m}
            </span>
          ))}
          {ROW_LABELS.map((label, row) => (
            <Row
              key={row}
              label={label}
              cells={weeks.map((w) => w[row])}
              byDay={byDay}
              today={today}
              onHover={setHover}
            />
          ))}
        </div>
      </div>
      <figcaption className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink-muted">
        <span aria-live="polite" className="min-h-4 text-ink-soft">
          {hover
            ? describe(hover, byDay.get(hover))
            : `${studied} ngày có học trong ${weeks.length} tuần qua`}
        </span>
        <span className="flex items-center gap-1" aria-hidden="true">
          Ít
          {LEVEL_CLASS.map((c) => (
            <span key={c} className={`h-3 w-3 rounded-[3px] ${c}`} />
          ))}
          Nhiều
        </span>
      </figcaption>
    </figure>
  );
}

function Row({
  label,
  cells,
  byDay,
  today,
  onHover,
}: {
  label: string;
  cells: (string | null)[];
  byDay: Map<string, DayActivity>;
  today: string;
  onHover(day: string | null): void;
}) {
  return (
    <>
      <span className="pr-1 text-right text-[10px] leading-[14px] text-ink-muted">{label}</span>
      {cells.map((day, i) => {
        if (!day) return <span key={i} />;
        const a = byDay.get(day);
        const level = activityLevel(a ? a.answers + a.tasks + a.cards : 0);
        return (
          <span
            key={day}
            title={describe(day, a)}
            onMouseEnter={() => onHover(day)}
            className={`h-[14px] w-[14px] rounded-[3px] ${LEVEL_CLASS[level]} ${
              day === today ? 'ring-2 ring-accent ring-offset-1 ring-offset-surface' : ''
            }`}
          />
        );
      })}
    </>
  );
}
