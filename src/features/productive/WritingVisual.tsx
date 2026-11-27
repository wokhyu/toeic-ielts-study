import { useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { WritingVisual as Visual } from '../../content/schema.ts';
import { prefersReducedMotion } from '../../lib/theme.ts';

type Of<T extends Visual['type']> = Extract<Visual, { type: T }>;

const series = (i: number) => `var(--color-series-${(i % 5) + 1})`;

const tooltipStyle = {
  contentStyle: {
    background: 'var(--color-surface)',
    border: '1px solid var(--color-line)',
    borderRadius: 12,
    boxShadow: 'var(--shadow-soft)',
    fontSize: 13,
  },
  labelStyle: { color: 'var(--color-ink-muted)' },
  itemStyle: { color: 'var(--color-ink)' },
};

const axis = {
  fontSize: 12,
  tick: { fill: 'var(--color-ink-muted)' },
  tickLine: false,
} as const;

/** Legend in the series' own order (Recharts sorts by name otherwise). */
const legend = (names: string[]) => (
  <Legend
    iconType="square"
    itemSorter={(item) => names.indexOf(String(item.dataKey ?? item.value))}
    formatter={(value: string) => <span style={{ color: 'var(--color-ink-soft)' }}>{value}</span>}
  />
);

/** A Task 1 visual drawn from data, with a table of the same numbers one click away. */
export function WritingVisual({ visual }: { visual: Visual }) {
  return (
    <figure className="space-y-2">
      <figcaption className="text-center text-sm font-semibold text-ink">
        {visual.title}
        {'unit' in visual && visual.type !== 'pie' && (
          <span className="font-normal text-ink-muted"> ({visual.unit})</span>
        )}
      </figcaption>
      {visual.type === 'line' && <LineVisual v={visual} />}
      {visual.type === 'bar' && <BarVisual v={visual} />}
      {visual.type === 'pie' && <PieVisual v={visual} />}
      {visual.type === 'table' && <TableVisual v={visual} />}
      {visual.type === 'process' && <ProcessVisual v={visual} />}
      {visual.type === 'map' && <MapVisual v={visual} />}
    </figure>
  );
}

function rowsOf(v: Of<'line'> | Of<'bar'>) {
  return v.categories.map((c, i) => ({
    category: c,
    ...Object.fromEntries(v.series.map((s) => [s.name, s.values[i]])),
  }));
}

/** The numbers behind a chart, for readers who prefer a table. */
function DataToggle({ columns, rows }: { columns: string[]; rows: (string | number)[][] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="text-center">
      <button
        type="button"
        className="text-xs font-medium text-brand-ink hover:underline"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        {open ? 'Ẩn bảng số liệu' : 'Xem bảng số liệu'}
      </button>
      {open && <SimpleTable columns={columns} rows={rows} />}
    </div>
  );
}

function SimpleTable({ columns, rows }: { columns: string[]; rows: (string | number)[][] }) {
  return (
    <div className="mt-2 overflow-x-auto">
      <table className="mx-auto text-sm">
        <thead>
          <tr className="text-xs text-ink-muted">
            {columns.map((c, i) => (
              <th key={i} className={`px-3 py-1.5 font-medium ${i === 0 ? 'text-left' : 'text-right'}`}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-line">
              {r.map((cell, j) => (
                <td
                  key={j}
                  className={`px-3 py-1.5 ${j === 0 ? 'text-left text-ink' : 'text-right tabular-nums'}`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LineVisual({ v }: { v: Of<'line'> }) {
  return (
    <>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rowsOf(v)} margin={{ top: 8, left: -8, right: 16 }}>
            <CartesianGrid vertical={false} stroke="var(--color-grid)" />
            <XAxis dataKey="category" {...axis} axisLine={{ stroke: 'var(--color-axis)' }} />
            <YAxis {...axis} axisLine={false} />
            <Tooltip cursor={{ stroke: 'var(--color-axis)' }} {...tooltipStyle} />
            {v.series.length > 1 && legend(v.series.map((s) => s.name))}
            {v.series.map((s, i) => (
              <Line
                key={s.name}
                dataKey={s.name}
                stroke={series(i)}
                strokeWidth={2}
                dot={{ r: 4, fill: series(i), stroke: 'var(--color-surface)', strokeWidth: 2 }}
                isAnimationActive={!prefersReducedMotion()}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <DataToggle
        columns={['', ...v.series.map((s) => s.name)]}
        rows={v.categories.map((c, i) => [c, ...v.series.map((s) => s.values[i])])}
      />
    </>
  );
}

function BarVisual({ v }: { v: Of<'bar'> }) {
  return (
    <>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rowsOf(v)} margin={{ top: 8, left: -8, right: 16 }} barGap={2}>
            <CartesianGrid vertical={false} stroke="var(--color-grid)" />
            <XAxis dataKey="category" {...axis} axisLine={{ stroke: 'var(--color-axis)' }} />
            <YAxis {...axis} axisLine={false} />
            <Tooltip cursor={{ fill: 'var(--color-subtle)' }} {...tooltipStyle} />
            {v.series.length > 1 && legend(v.series.map((s) => s.name))}
            {v.series.map((s, i) => (
              <Bar
                key={s.name}
                dataKey={s.name}
                fill={series(i)}
                maxBarSize={28}
                radius={[4, 4, 0, 0]}
                isAnimationActive={!prefersReducedMotion()}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <DataToggle
        columns={['', ...v.series.map((s) => s.name)]}
        rows={v.categories.map((c, i) => [c, ...v.series.map((s) => s.values[i])])}
      />
    </>
  );
}

function PieVisual({ v }: { v: Of<'pie'> }) {
  // One colour per category across all pies, so "Car" looks the same in 2000 and 2020.
  const labels = [...new Set(v.pies.flatMap((p) => p.slices.map((s) => s.label)))];
  return (
    <>
      <div className={`grid gap-2 ${v.pies.length > 1 ? 'sm:grid-cols-2' : ''}`}>
        {v.pies.map((p) => (
          <div key={p.caption}>
            <p className="text-center text-sm font-medium text-ink-soft">{p.caption}</p>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart margin={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Pie
                    data={p.slices}
                    dataKey="value"
                    nameKey="label"
                    outerRadius="62%"
                    stroke="var(--color-surface)"
                    strokeWidth={2}
                    // Values in text ink, not the slice colour; names are in the legend.
                    label={(props: { x?: number; y?: number; value?: number; textAnchor?: string }) => (
                      <text
                        x={props.x}
                        y={props.y}
                        textAnchor={props.textAnchor as 'start' | 'middle' | 'end' | undefined}
                        dominantBaseline="central"
                        fontSize={12}
                        fill="var(--color-ink-soft)"
                      >
                        {props.value}%
                      </text>
                    )}
                    labelLine={false}
                    isAnimationActive={!prefersReducedMotion()}
                  >
                    {p.slices.map((s) => (
                      <Cell key={s.label} fill={series(labels.indexOf(s.label))} />
                    ))}
                  </Pie>
                  <Tooltip {...tooltipStyle} formatter={(value) => `${String(value)}%`} />
                  <Legend
                    iconType="square"
                    itemSorter={(item) => labels.indexOf(String(item.value))}
                    formatter={(value: string) => (
                      <span style={{ color: 'var(--color-ink-soft)', fontSize: 12 }}>{value}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        ))}
      </div>
      <DataToggle
        columns={['', ...v.pies.map((p) => p.caption)]}
        rows={labels.map((label) => [
          label,
          ...v.pies.map((p) => {
            const slice = p.slices.find((s) => s.label === label);
            return slice ? `${slice.value}%` : '—';
          }),
        ])}
      />
    </>
  );
}

function TableVisual({ v }: { v: Of<'table'> }) {
  return (
    <SimpleTable
      columns={['', ...v.columns]}
      rows={v.rows.map((r) => [r.label, ...r.values.map((x) => x.toLocaleString('en-GB'))])}
    />
  );
}

function ProcessVisual({ v }: { v: Of<'process'> }) {
  return (
    <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {v.steps.map((step, i) => (
        <li
          key={i}
          className="flex items-start gap-2 rounded-2xl bg-subtle p-3 text-sm text-ink ring-1 ring-line"
        >
          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand text-xs font-semibold text-on-solid">
            {i + 1}
          </span>
          <span>{step}</span>
        </li>
      ))}
    </ol>
  );
}

const MAP_STYLE: Record<string, { fill: string; opacity: number }> = {
  building: { fill: 'var(--color-line-strong)', opacity: 0.7 },
  green: { fill: 'var(--color-series-3)', opacity: 0.35 },
  water: { fill: 'var(--color-series-1)', opacity: 0.35 },
  road: { fill: 'var(--color-ink-faint)', opacity: 0.45 },
  other: { fill: 'var(--color-series-4)', opacity: 0.35 },
};

function MapVisual({ v }: { v: Of<'map'> }) {
  return (
    <div className={`grid gap-3 ${v.maps.length > 1 ? 'md:grid-cols-2' : ''}`}>
      {v.maps.map((m) => (
        <div key={m.caption}>
          <p className="text-center text-sm font-medium text-ink-soft">{m.caption}</p>
          <svg
            viewBox="-2 -2 104 64"
            className="w-full rounded-xl bg-surface ring-1 ring-line"
            role="img"
            aria-label={`${v.title}, ${m.caption}: ${m.features.map((f) => f.label).join(', ')}`}
          >
            {m.features.map((f, i) => (
              <g key={i}>
                <rect
                  x={f.x}
                  y={f.y}
                  width={f.w}
                  height={f.h}
                  rx={1}
                  fill={MAP_STYLE[f.kind].fill}
                  fillOpacity={MAP_STYLE[f.kind].opacity}
                  stroke="var(--color-line-strong)"
                  strokeWidth={0.3}
                />
                <text
                  x={f.x + f.w / 2}
                  y={f.y + f.h / 2}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={f.w < 10 ? 2.4 : 3.2}
                  fill="var(--color-ink)"
                  transform={
                    f.w < 10 && f.h > f.w ? `rotate(-90 ${f.x + f.w / 2} ${f.y + f.h / 2})` : undefined
                  }
                >
                  {f.label}
                </text>
              </g>
            ))}
            <text x={98} y={4} textAnchor="end" fontSize={3} fill="var(--color-ink-muted)">
              N ↑
            </text>
          </svg>
        </div>
      ))}
    </div>
  );
}
