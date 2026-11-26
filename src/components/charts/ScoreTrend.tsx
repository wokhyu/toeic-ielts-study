import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatDateVN } from '../../lib/dates.ts';
import { prefersReducedMotion } from '../../lib/theme.ts';

export interface ScorePoint {
  taken_at: string;
  total: number;
  listening?: number | null;
  reading?: number | null;
  writing?: number | null;
  speaking?: number | null;
}

const LABEL: Record<string, string> = {
  total: 'Tổng',
  listening: 'Listening',
  reading: 'Reading',
  writing: 'Writing',
  speaking: 'Speaking',
};

/**
 * Mock test scores over time on one axis (sections and total share the unit),
 * series colours in fixed order, and the track's target as a dashed reference.
 * The page shows the same numbers in a table, which is the text alternative.
 */
export function ScoreTrend({
  program,
  rows,
  target,
  height = 256,
}: {
  program: 'toeic' | 'ielts';
  rows: ScorePoint[];
  target?: number | null;
  height?: number;
}) {
  const fields =
    program === 'toeic'
      ? ['total', 'listening', 'reading']
      : ['total', 'listening', 'reading', 'writing', 'speaking'];
  const animate = !prefersReducedMotion();
  const data = rows.map((r) => ({ ...r, label: formatDateVN(r.taken_at).slice(0, 5) }));
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, left: -10, right: 12 }}>
          <CartesianGrid vertical={false} stroke="var(--color-grid)" />
          <XAxis
            dataKey="label"
            fontSize={12}
            tick={{ fill: 'var(--color-ink-muted)' }}
            axisLine={{ stroke: 'var(--color-axis)' }}
            tickLine={false}
          />
          <YAxis
            fontSize={12}
            domain={program === 'toeic' ? [0, 990] : [0, 9]}
            tick={{ fill: 'var(--color-ink-muted)' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ stroke: 'var(--color-axis)' }}
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
            itemSorter={(item) => fields.indexOf(String(item.dataKey))}
            iconType="plainline"
            formatter={(value: string) => <span style={{ color: 'var(--color-ink-soft)' }}>{value}</span>}
          />
          {target != null && (
            <ReferenceLine
              y={target}
              stroke="var(--color-accent)"
              strokeDasharray="6 4"
              label={{
                value: `Mục tiêu ${target}`,
                position: 'insideTopRight',
                fill: 'var(--color-accent-ink)',
                fontSize: 12,
              }}
            />
          )}
          {fields.map((f, i) => (
            <Line
              key={f}
              type="monotone"
              dataKey={f}
              name={LABEL[f]}
              stroke={`var(--color-series-${i + 1})`}
              strokeWidth={2}
              strokeLinecap="round"
              dot={{
                r: 4,
                strokeWidth: 2,
                stroke: 'var(--color-surface)',
                fill: `var(--color-series-${i + 1})`,
              }}
              activeDot={{ r: 6, strokeWidth: 2, stroke: 'var(--color-surface)' }}
              connectNulls
              isAnimationActive={animate}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
