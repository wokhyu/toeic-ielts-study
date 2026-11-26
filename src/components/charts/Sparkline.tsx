/**
 * A tiny line of recent daily activity: muted line, the latest day as a brand dot.
 * Purely a glance; the table cell next to it carries the numbers.
 */
export function Sparkline({
  values,
  width = 96,
  height = 26,
  label,
}: {
  values: number[];
  width?: number;
  height?: number;
  label: string;
}) {
  const max = Math.max(1, ...values);
  const step = values.length > 1 ? (width - 4) / (values.length - 1) : 0;
  const pts = values.map((v, i) => [2 + i * step, height - 3 - (v / max) * (height - 6)] as const);
  const last = pts.at(-1);
  return (
    <svg width={width} height={height} role="img" aria-label={label} className="overflow-visible">
      <line x1={2} x2={width - 2} y1={height - 3} y2={height - 3} className="stroke-line" strokeWidth={1} />
      <polyline
        points={pts.map(([x, y]) => `${x},${y}`).join(' ')}
        fill="none"
        className="stroke-ink-faint"
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {last && (
        <circle cx={last[0]} cy={last[1]} r={3} className="fill-brand stroke-surface" strokeWidth={1.5} />
      )}
    </svg>
  );
}
