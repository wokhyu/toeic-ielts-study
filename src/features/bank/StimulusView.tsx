import { Rich } from '../../components/Rich.tsx';
import { ListenPlayer } from '../../components/Speak.tsx';
import type { Stimulus } from '../../lib/bank.ts';
import { useBank } from './context.ts';

/**
 * A passage (TOEIC Part 6/7, IELTS Reading) or a recording (TOEIC Part 3/4,
 * IELTS Listening) shared by several questions. In exam mode a recording can be
 * played once and its transcript stays hidden.
 */
export function StimulusView({
  stimulus,
  exam = false,
  showTranscript = false,
  playKey,
}: {
  stimulus: Stimulus;
  exam?: boolean;
  showTranscript?: boolean;
  playKey?: string;
}) {
  const { lang } = useBank();

  if (stimulus.kind === 'audio') {
    return (
      <div className="space-y-2 rounded-2xl bg-lilac-soft/60 p-3.5 ring-1 ring-line">
        {stimulus.title && <p className="text-sm font-medium">{stimulus.title}</p>}
        <ListenPlayer
          script={stimulus.audio_script ?? ''}
          lang={lang}
          maxPlays={exam ? 1 : undefined}
          storageKey={exam ? playKey : undefined}
        />
        {stimulus.html && <Rich html={stimulus.html} />}
        {showTranscript && stimulus.audio_script && (
          <details className="text-sm">
            <summary className="cursor-pointer font-medium text-ink-soft">Xem script</summary>
            <p className="mt-2 whitespace-pre-line leading-relaxed text-ink-soft">{stimulus.audio_script}</p>
          </details>
        )}
      </div>
    );
  }

  return (
    <div className="max-h-[70vh] overflow-y-auto rounded-2xl bg-subtle p-4 text-[15px] leading-relaxed ring-1 ring-line">
      {stimulus.title && <p className="mb-2 font-medium">{stimulus.title}</p>}
      <Rich html={stimulus.html} />
    </div>
  );
}
