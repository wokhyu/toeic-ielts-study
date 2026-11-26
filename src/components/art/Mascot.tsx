/**
 * "Bé Cú", the site's owl. Drawn here from simple shapes (no outside artwork),
 * coloured with theme tokens so it follows light and dark mode.
 */
export type Mood = 'happy' | 'thinking' | 'cheer' | 'sleepy' | 'oops';

const LABEL: Record<Mood, string> = {
  happy: 'Bé Cú đang vui',
  thinking: 'Bé Cú đang suy nghĩ',
  cheer: 'Bé Cú đang cổ vũ',
  sleepy: 'Bé Cú buồn ngủ',
  oops: 'Bé Cú hơi bối rối',
};

const INK = '#1f2a37';
const BELLY = '#fff4e0';

function Eyes({ mood }: { mood: Mood }) {
  if (mood === 'cheer') {
    return (
      <g fill="none" stroke={INK} strokeWidth={4} strokeLinecap="round">
        <path d="M36 52 Q44 42 52 52" />
        <path d="M68 52 Q76 42 84 52" />
      </g>
    );
  }
  if (mood === 'sleepy') {
    return (
      <g fill="none" stroke={INK} strokeWidth={3.5} strokeLinecap="round">
        <path d="M36 50 Q44 57 52 50" />
        <path d="M68 50 Q76 57 84 50" />
      </g>
    );
  }
  const dx = mood === 'thinking' ? 4 : 0;
  const dy = mood === 'thinking' ? -4 : 1;
  const r = mood === 'oops' ? 4.5 : 7;
  return (
    <g>
      <circle cx={44 + dx} cy={50 + dy} r={r} fill={INK} />
      <circle cx={76 + dx} cy={50 + dy} r={r} fill={INK} />
      <circle cx={46.5 + dx} cy={47.5 + dy} r={2.4} fill="#fff" />
      <circle cx={78.5 + dx} cy={47.5 + dy} r={2.4} fill="#fff" />
    </g>
  );
}

export function Mascot({
  mood = 'happy',
  size = 96,
  className = '',
  decorative = false,
}: {
  mood?: Mood;
  size?: number;
  className?: string;
  /** Hide from screen readers when the text next to it already says the same thing. */
  decorative?: boolean;
}) {
  const wingsUp = mood === 'cheer';
  return (
    <svg
      viewBox="0 0 120 124"
      width={size}
      height={size}
      className={className}
      role={decorative ? undefined : 'img'}
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : LABEL[mood]}
    >
      {/* ear tufts */}
      <path d="M28 34 L34 8 L52 26 Z" className="fill-brand-strong" />
      <path d="M92 34 L86 8 L68 26 Z" className="fill-brand-strong" />
      {/* wings */}
      <g className="fill-brand-strong">
        {wingsUp ? (
          <>
            <ellipse cx="16" cy="48" rx="9" ry="22" transform="rotate(-35 16 48)" />
            <ellipse cx="104" cy="48" rx="9" ry="22" transform="rotate(35 104 48)" />
          </>
        ) : (
          <>
            <ellipse cx="22" cy="78" rx="10" ry="24" transform="rotate(12 22 78)" />
            <ellipse
              cx={mood === 'thinking' ? 92 : 98}
              cy={mood === 'thinking' ? 70 : 78}
              rx="10"
              ry="24"
              transform={mood === 'thinking' ? 'rotate(-50 92 70)' : 'rotate(-12 98 78)'}
            />
          </>
        )}
      </g>
      {/* body */}
      <ellipse cx="60" cy="68" rx="40" ry="46" className="fill-brand" />
      <ellipse cx="60" cy="84" rx="25" ry="27" fill={BELLY} />
      <g fill="none" className="stroke-brand/35" strokeWidth={2} strokeLinecap="round">
        <path d="M50 80 l4 4 l4 -4" />
        <path d="M62 80 l4 4 l4 -4" />
        <path d="M56 92 l4 4 l4 -4" />
      </g>
      {/* eye discs */}
      <circle cx="44" cy="50" r="15" fill="#fff" className="stroke-brand-strong" strokeWidth={2} />
      <circle cx="76" cy="50" r="15" fill="#fff" className="stroke-brand-strong" strokeWidth={2} />
      <Eyes mood={mood} />
      {mood === 'oops' && (
        <g fill="none" stroke={INK} strokeWidth={2.5} strokeLinecap="round">
          <path d="M34 33 L50 37" />
          <path d="M86 33 L70 37" />
        </g>
      )}
      {/* cheeks */}
      <circle cx="31" cy="64" r="5" className="fill-accent" opacity={0.35} />
      <circle cx="89" cy="64" r="5" className="fill-accent" opacity={0.35} />
      {/* beak */}
      {wingsUp ? (
        <>
          <path d="M53 61 L67 61 L60 66 Z" className="fill-accent" />
          <path d="M55 67 L65 67 L60 74 Z" className="fill-accent-strong" />
        </>
      ) : (
        <path d="M53 61 L67 61 L60 71 Z" className="fill-accent" />
      )}
      {/* feet */}
      <ellipse cx="47" cy="114" rx="8" ry="4" className="fill-accent" />
      <ellipse cx="73" cy="114" rx="8" ry="4" className="fill-accent" />

      {mood === 'thinking' && (
        <text x="98" y="22" fontSize="22" fontWeight="700" className="fill-accent">
          ?
        </text>
      )}
      {mood === 'sleepy' && (
        <g className="fill-ink-muted" fontWeight="600">
          <text x="92" y="24" fontSize="14">
            z
          </text>
          <text x="102" y="14" fontSize="18">
            Z
          </text>
        </g>
      )}
      {mood === 'oops' && <path d="M100 38 q6 9 0 12 q-6 -3 0 -12 Z" fill="#7cc4f0" />}
      {mood === 'cheer' && (
        <g className="fill-butter">
          <path d="M8 14 l2.5 6 l6 2.5 l-6 2.5 l-2.5 6 l-2.5 -6 l-6 -2.5 l6 -2.5 Z" />
          <path d="M110 8 l2 4.5 l4.5 2 l-4.5 2 l-2 4.5 l-2 -4.5 l-4.5 -2 l4.5 -2 Z" />
        </g>
      )}
    </svg>
  );
}
