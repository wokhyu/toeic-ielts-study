import type { CourseId } from '../../lib/types.ts';

/**
 * Banner illustrations for each course, drawn from simple shapes and coloured
 * with theme tokens: TOEIC is a harbour city, IELTS mountains and a book,
 * on-tap-11 an atom and formulas. Purely decorative.
 */
export function CourseArt({ course, className = '' }: { course: CourseId; className?: string }) {
  return (
    <svg
      viewBox="0 0 320 120"
      preserveAspectRatio="xMidYMid slice"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {course === 'toeic' && <Toeic />}
      {course === 'ielts' && <Ielts />}
      {course === 'on-tap-11' && <OnTap />}
    </svg>
  );
}

function Toeic() {
  return (
    <>
      <rect width="320" height="120" className="fill-brand-soft" />
      <circle cx="262" cy="34" r="16" className="fill-butter" />
      <g className="fill-brand/70">
        <rect x="40" y="38" width="26" height="52" rx="3" />
        <rect x="72" y="22" width="22" height="68" rx="3" />
        <rect x="100" y="48" width="30" height="42" rx="3" />
        <rect x="136" y="30" width="18" height="60" rx="3" />
        <rect x="160" y="54" width="34" height="36" rx="3" />
        <rect x="200" y="40" width="22" height="50" rx="3" />
      </g>
      <g className="fill-surface" opacity={0.8}>
        {[0, 1, 2, 3].map((r) => (
          <g key={r}>
            <rect x="78" y={30 + r * 12} width="4" height="5" rx="1" />
            <rect x="85" y={30 + r * 12} width="4" height="5" rx="1" />
            <rect x="140" y={38 + r * 11} width="4" height="5" rx="1" />
            <rect x="46" y={46 + r * 10} width="4" height="5" rx="1" />
            <rect x="55" y={46 + r * 10} width="4" height="5" rx="1" />
          </g>
        ))}
      </g>
      <path
        d="M0 92 Q20 84 40 92 T80 92 T120 92 T160 92 T200 92 T240 92 T280 92 T320 92 V120 H0 Z"
        className="fill-brand"
      />
      <path
        d="M0 104 Q20 96 40 104 T80 104 T120 104 T160 104 T200 104 T240 104 T280 104 T320 104 V120 H0 Z"
        className="fill-brand-strong"
      />
      <path d="M244 84 L292 84 L284 94 L252 94 Z" className="fill-accent" />
      <rect x="262" y="68" width="3" height="16" className="fill-ink-soft" />
      <path d="M265 68 L282 76 L265 80 Z" className="fill-butter" />
    </>
  );
}

function Ielts() {
  return (
    <>
      <rect width="320" height="120" className="fill-lilac-soft" />
      <circle cx="60" cy="32" r="14" className="fill-butter" />
      <path d="M0 96 L70 40 L120 80 L170 30 L240 92 L280 60 L320 86 V120 H0 Z" className="fill-lilac" />
      <path d="M170 30 L186 44 L176 46 L170 40 L162 46 L156 42 Z" fill="#fff" opacity={0.85} />
      <path d="M70 40 L82 50 L74 52 L68 48 L62 52 Z" fill="#fff" opacity={0.85} />
      <rect y="96" width="320" height="24" className="fill-mint" />
      {/* open book */}
      <g transform="translate(206 70)">
        <path d="M0 10 Q22 0 44 10 V40 Q22 30 0 40 Z" fill="#fffdf8" />
        <path d="M44 10 Q66 0 88 10 V40 Q66 30 44 40 Z" fill="#fffdf8" />
        <path d="M44 10 V40" stroke="#d8ccb9" strokeWidth={2} />
        <g className="stroke-lilac" strokeWidth={2} strokeLinecap="round">
          <path d="M10 18 H34" />
          <path d="M10 25 H30" />
          <path d="M54 18 H78" />
          <path d="M54 25 H74" />
        </g>
      </g>
      <rect x="168" y="14" width="2.5" height="18" className="fill-ink-soft" />
      <path d="M170.5 14 L186 19 L170.5 24 Z" className="fill-accent" />
    </>
  );
}

function OnTap() {
  return (
    <>
      <rect width="320" height="120" className="fill-butter-soft" />
      <g transform="translate(250 60)" fill="none" className="stroke-accent" strokeWidth={3}>
        <ellipse rx="40" ry="14" />
        <ellipse rx="40" ry="14" transform="rotate(60)" />
        <ellipse rx="40" ry="14" transform="rotate(-60)" />
      </g>
      <circle cx="250" cy="60" r="8" className="fill-accent" />
      <g className="fill-brand/80" fontWeight="600" fontFamily="inherit">
        <text x="28" y="44" fontSize="22">
          sin²x + cos²x = 1
        </text>
        <text x="28" y="78" fontSize="18">
          F = m·a
        </text>
        <text x="110" y="78" fontSize="18">
          H₂O
        </text>
      </g>
      <path d="M176 92 L190 60 L204 92 Z" fill="none" className="stroke-brand" strokeWidth={3} />
      <path d="M30 100 H170" className="stroke-butter" strokeWidth={6} strokeLinecap="round" />
    </>
  );
}
