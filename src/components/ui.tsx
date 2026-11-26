import { useId, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Mascot, type Mood } from './art/Mascot.tsx';
import { IconInfo } from './icons.tsx';
import { buttonClass, type ButtonSize, type ButtonVariant } from './styles.ts';

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <button type="button" className={buttonClass(variant, size, className)} {...props} />;
}

type CardVariant = 'plain' | 'soft' | 'hero';
const CARD: Record<CardVariant, string> = {
  plain: 'bg-surface shadow-soft ring-1 ring-line',
  soft: 'bg-subtle ring-1 ring-line',
  hero: 'bg-brand-soft ring-1 ring-brand/15',
};

export function Card({
  children,
  className = '',
  variant = 'plain',
}: {
  children: ReactNode;
  className?: string;
  variant?: CardVariant;
}) {
  return (
    <div className={`rounded-[var(--radius-card)] p-4 sm:p-5 ${CARD[variant]} ${className}`}>{children}</div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-sm text-ink-soft">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

const BADGE = {
  gray: 'bg-muted text-ink-soft',
  green: 'bg-ok-soft text-ok-ink',
  yellow: 'bg-warn-soft text-warn-ink',
  red: 'bg-bad-soft text-bad-ink',
  blue: 'bg-brand-soft text-brand-ink',
  coral: 'bg-accent-soft text-accent-ink',
  lilac: 'bg-lilac-soft text-ink',
} as const;
export type BadgeColor = keyof typeof BADGE;

export function Badge({ children, color = 'gray' }: { children: ReactNode; color?: BadgeColor }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${BADGE[color]}`}
    >
      {children}
    </span>
  );
}

/** A selectable pill, e.g. a filter or a day of the week. */
export function Chip({
  active,
  children,
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={`rounded-full px-3 py-1 text-sm font-medium transition ${
        active ? 'bg-brand text-on-solid shadow-soft' : 'bg-muted text-ink-soft hover:bg-line hover:text-ink'
      } ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function Spinner({ label = 'Đang tải…' }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 py-10 text-sm text-ink-muted" role="status">
      <span className="animate-float">
        <Mascot mood="thinking" size={44} decorative />
      </span>
      {label}
    </div>
  );
}

/** Grey placeholder blocks shown while content loads. */
export function Skeleton({ className = 'h-4 w-full' }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-muted ${className}`} aria-hidden="true" />;
}

export function ErrorBox({ message }: { message: string }) {
  return (
    <div
      className="flex items-start gap-2 rounded-xl bg-bad-soft p-3 text-sm text-bad-ink ring-1 ring-bad/25"
      role="alert"
    >
      <span aria-hidden="true" className="font-semibold">
        !
      </span>
      <span>{message}</span>
    </div>
  );
}

export function Notice({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl bg-warn-soft p-3 text-sm text-warn-ink ring-1 ring-warn/25">{children}</div>
  );
}

export function ProgressBar({ value, label }: { value: number; label?: string }) {
  const v = Math.min(100, Math.max(0, value));
  return (
    <div
      className="h-2.5 w-full overflow-hidden rounded-full bg-muted"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(v)}
      aria-label={label ?? `${Math.round(v)}%`}
    >
      <div
        className="h-full rounded-full bg-brand transition-[width] duration-500"
        style={{ width: `${v}%` }}
      />
    </div>
  );
}

/** A circular progress meter with the value in the middle. */
export function ProgressRing({
  value,
  size = 64,
  stroke = 7,
  label,
  children,
}: {
  value: number;
  size?: number;
  stroke?: number;
  label: string;
  children?: ReactNode;
}) {
  const v = Math.min(100, Math.max(0, value));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div
      className="relative inline-grid place-items-center"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${label}: ${Math.round(v)}%`}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-muted" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v / 100)}
          className="stroke-brand transition-[stroke-dashoffset] duration-700"
        />
      </svg>
      <span className="absolute text-sm font-semibold text-ink">{children ?? `${Math.round(v)}%`}</span>
    </div>
  );
}

/** One headline number with a label, an optional icon and a short note. */
export function StatTile({
  label,
  value,
  icon,
  note,
  tone = 'brand',
}: {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  note?: ReactNode;
  tone?: 'brand' | 'accent' | 'butter' | 'lilac' | 'mint';
}) {
  const TONE = {
    brand: 'bg-brand-soft text-brand-ink',
    accent: 'bg-accent-soft text-accent-ink',
    butter: 'bg-butter-soft text-warn-ink',
    lilac: 'bg-lilac-soft text-ink',
    mint: 'bg-mint-soft text-ok-ink',
  };
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-surface p-3.5 shadow-soft ring-1 ring-line">
      {icon && (
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${TONE[tone]}`}>{icon}</span>
      )}
      <div className="min-w-0">
        <p className="text-xs text-ink-muted">{label}</p>
        <p className="text-xl font-semibold text-ink">{value}</p>
        {note && <p className="text-xs text-ink-muted">{note}</p>}
      </div>
    </div>
  );
}

/** Friendly placeholder for lists with nothing in them yet. */
export function EmptyState({
  title,
  children,
  action,
  mood = 'sleepy',
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  mood?: Mood;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-[var(--radius-card)] bg-surface px-6 py-10 text-center shadow-soft ring-1 ring-line">
      <Mascot mood={mood} size={84} decorative />
      <p className="mt-1 font-semibold text-ink">{title}</p>
      {children && <div className="max-w-md text-sm text-ink-soft">{children}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/** A small "i" button that explains a term in plain words. */
export function InfoHint({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <span className="relative inline-flex align-middle">
      <button
        type="button"
        className="rounded-full p-0.5 text-ink-faint hover:text-brand-ink"
        aria-label={`Giải thích: ${label}`}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        onBlur={() => setOpen(false)}
      >
        <IconInfo size={15} />
      </button>
      {open && (
        <span
          id={id}
          role="tooltip"
          className="absolute top-6 left-1/2 z-20 w-64 -translate-x-1/2 animate-rise rounded-xl bg-ink p-3 text-xs leading-relaxed font-normal text-on-solid shadow-lift"
        >
          {children}
        </span>
      )}
    </span>
  );
}

export const inputClass =
  'w-full rounded-xl border border-line-strong bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30';

export const selectClass =
  'rounded-lg border border-line-strong bg-surface px-2.5 py-1.5 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30';

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-ink-soft">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink-muted">{hint}</span>}
    </label>
  );
}
