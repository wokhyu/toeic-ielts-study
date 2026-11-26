import { Mascot, type Mood } from '../../components/art/Mascot.tsx';

export function AuthHeader({ title, subtitle, mood }: { title: string; subtitle?: string; mood: Mood }) {
  return (
    <div className="mb-5 flex flex-col items-center text-center">
      <span className="animate-float">
        <Mascot mood={mood} size={76} decorative />
      </span>
      <h1 className="mt-2 text-xl font-semibold text-ink">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-ink-soft">{subtitle}</p>}
    </div>
  );
}
