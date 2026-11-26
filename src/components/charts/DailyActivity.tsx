import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatDateVN } from '../../lib/dates.ts';
import { fillDays } from '../../lib/stats.ts';
import { prefersReducedMotion } from '../../lib/theme.ts';

import type { DailyRow } from '../../lib/stats.ts';

export type { DailyRow };

const SERIES = [
  { key: 'answers', name: 'Câu hỏi', color: 'var(--color-series-1)' },
  { key: 'tasks', name: 'Nhiệm vụ', color: 'var(--color-series-2)' },
  { key: 'cards', name: 'Lượt ôn thẻ', color: 'var(--color-series-3)' },
] as const;

/** Stacked columns of study activity per day: answers, ticked tasks and flashcard reviews. */
export function DailyActivity({
  rows,
  from,
  to,
  height = 240,
}: {
  rows: DailyRow[];
  from: string;
  to: string;
  height?: number;
}) {
  const data = fillDays(rows, from, to).map((r) => ({ ...r, label: formatDateVN(r.day).slice(0, 5) }));
  const animate = !prefersReducedMotion();
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, left: -18, right: 8 }}>
          <CartesianGrid vertical={false} stroke="var(--color-grid)" />
          <XAxis
            dataKey="label"
            fontSize={11}
            tick={{ fill: 'var(--color-ink-muted)' }}
            axisLine={{ stroke: 'var(--color-axis)' }}
            tickLine={false}
            interval="preserveStartEnd"
            minTickGap={16}
          />
          <YAxis
            fontSize={11}
            allowDecimals={false}
            tick={{ fill: 'var(--color-ink-muted)' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: 'var(--color-muted)', opacity: 0.6 }}
            contentStyle={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-line)',
              borderRadius: 12,
              boxShadow: 'var(--shadow-soft)',
              fontSize: 13,
            }}
            labelStyle={{ color: 'var(--color-ink-muted)' }}
            itemStyle={{ color: 'var(--color-ink)' }}
          />
          <Legend
            // Same order as the stack, bottom to top.
            itemSorter={(item) => SERIES.findIndex((x) => x.key === item.dataKey)}
            iconType="square"
            formatter={(value: string) => <span style={{ color: 'var(--color-ink-soft)' }}>{value}</span>}
          />
          {SERIES.map((s, i) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              name={s.name}
              stackId="a"
              fill={s.color}
              stroke="var(--color-surface)"
              strokeWidth={1}
              maxBarSize={24}
              radius={i === SERIES.length - 1 ? [4, 4, 0, 0] : 0}
              isAnimationActive={animate}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
