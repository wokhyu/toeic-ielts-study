/** Class builders shared by components and pages. */
export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'soft' | 'accent';
export type ButtonSize = 'sm' | 'md' | 'lg';

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-brand text-on-solid shadow-soft hover:bg-brand-strong disabled:bg-brand/40 disabled:shadow-none',
  secondary:
    'bg-surface text-ink ring-1 ring-line-strong hover:bg-subtle disabled:text-ink-faint disabled:hover:bg-surface',
  danger: 'bg-bad text-on-solid hover:bg-bad-strong disabled:bg-bad/40',
  ghost: 'text-ink-soft hover:bg-muted hover:text-ink disabled:text-ink-faint disabled:hover:bg-transparent',
  soft: 'bg-brand-soft text-brand-ink hover:bg-brand/20 disabled:opacity-50',
  accent: 'bg-accent text-on-solid shadow-soft hover:bg-accent-strong disabled:bg-accent/40',
};

const SIZES: Record<ButtonSize, string> = {
  sm: 'rounded-lg px-2.5 py-1.5 text-xs',
  md: 'rounded-xl px-4 py-2 text-sm',
  lg: 'rounded-2xl px-5 py-3 text-base',
};

/** Shared look for router links that should read as buttons. */
export function buttonClass(variant: ButtonVariant = 'primary', size: ButtonSize = 'md', className = '') {
  return `inline-flex items-center justify-center gap-2 font-medium transition active:scale-[0.98] disabled:cursor-not-allowed disabled:active:scale-100 ${SIZES[size]} ${VARIANTS[variant]} ${className}`;
}

/** Pill-shaped navigation tabs (for NavLink className). */
export const tabClass = ({ isActive }: { isActive: boolean }) =>
  `inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
    isActive
      ? 'bg-brand text-on-solid shadow-soft'
      : 'bg-surface text-ink-soft ring-1 ring-line hover:bg-subtle hover:text-ink'
  }`;
