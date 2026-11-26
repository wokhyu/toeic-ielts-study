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
      <div className="space-y-2 rounded-lg bg-slate-50 p-3">
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
            <summary className="cursor-pointer font-medium text-slate-700">Xem script</summary>
            <p className="mt-2 whitespace-pre-line leading-relaxed text-slate-700">{stimulus.audio_script}</p>
          </details>
        )}
      </div>
    );
  }

  return (
    <div className="max-h-[70vh] overflow-y-auto rounded-lg bg-slate-50 p-3 text-[15px] leading-relaxed">
      {stimulus.title && <p className="mb-2 font-medium">{stimulus.title}</p>}
      <Rich html={stimulus.html} />
    </div>
  );
}
