import type { CSSProperties } from 'react';
import { prefersReducedMotion } from '../lib/theme.ts';

const COLORS = [
  'var(--color-accent)',
  'var(--color-butter)',
  'var(--color-brand)',
  'var(--color-lilac)',
  'var(--color-mint)',
];

/**
 * A short burst of confetti over the parent (which needs `relative`). Change
 * `fire` to a new number to play it again. Skipped when the system asks for
 * reduced motion.
 */
export function Confetti({ fire, pieces = 18 }: { fire: number; pieces?: number }) {
  if (!fire || prefersReducedMotion()) return null;
  const bits = Array.from({ length: pieces }, (_, i) => ({
    left: `${8 + ((i * 53 + fire * 17) % 84)}%`,
    dx: `${((i * 37 + fire * 11) % 80) - 40}px`,
    spin: `${((i * 97) % 540) - 270}deg`,
    delay: `${(i % 6) * 40}ms`,
    color: COLORS[(i + fire) % COLORS.length],
  }));
  // Keyed by `fire`, so each new value restarts the animation; pieces end transparent.
  return (
    <div
      key={fire}
      className="pointer-events-none absolute inset-x-0 top-0 h-48 overflow-hidden"
      aria-hidden="true"
    >
      {bits.map((b, i) => (
        <span
          key={i}
          className="confetti-piece"
          style={
            {
              left: b.left,
              background: b.color,
              animationDelay: b.delay,
              '--dx': b.dx,
              '--spin': b.spin,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
