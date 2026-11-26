import type { ReactNode } from 'react';
import { wilson } from '../../lib/stats.ts';

export interface AccuracyRow {
  key: string;
  label: string;
  n: number;
  correct: number;
  action?: ReactNode;
}

/**
 * Horizontal accuracy bars (share of correct answers) with the 95% Wilson
 * interval drawn as a thin whisker, so a bar built on 3 answers is visibly less
 * certain than one built on 60. Rows with fewer than `minN` answers are shown
 * as "chưa đủ dữ liệu" instead of a bar.
 */
export function AccuracyBars({ rows, minN = 5 }: { rows: AccuracyRow[]; minN?: number }) {
  return (
    <ul className="space-y-3">
      {rows.map((r) => {
        const enough = r.n >= minN;
        const w = wilson(r.correct, r.n);
        const pct = Math.round(w.p * 100);
        return (
          <li key={r.key} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1">
            <span className="truncate text-sm text-ink">{r.label}</span>
            <span className="flex items-center justify-end gap-2 text-right text-sm text-ink-soft tabular-nums">
              {enough ? (
                <span>
                  <b className="text-ink">{pct}%</b> · {r.correct}/{r.n}
                </span>
              ) : (
                <span className="text-ink-muted">{r.n} câu · chưa đủ dữ liệu</span>
              )}
              {r.action}
            </span>
            <div
              className="relative col-span-2 h-3 rounded-full bg-muted"
              role="img"
              aria-label={
                enough
                  ? `${r.label}: đúng ${pct}%, khoảng tin cậy ${Math.round(w.low * 100)}–${Math.round(w.high * 100)}%`
                  : `${r.label}: mới có ${r.n} câu`
              }
            >
              {enough && (
                <>
                  <div
                    className="absolute inset-y-0 left-0 rounded-full bg-brand"
                    style={{ width: `${w.p * 100}%` }}
                  />
                  <div
                    className="absolute top-1/2 h-0.5 -translate-y-1/2 bg-ink/60"
                    style={{ left: `${w.low * 100}%`, width: `${(w.high - w.low) * 100}%` }}
                  />
                  <div className="absolute top-0 h-3 w-0.5 bg-ink/60" style={{ left: `${w.low * 100}%` }} />
                  <div
                    className="absolute top-0 h-3 w-0.5 bg-ink/60"
                    style={{ left: `calc(${w.high * 100}% - 2px)` }}
                  />
                </>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
