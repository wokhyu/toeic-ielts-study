import { useEffect, useState } from 'react';
import { speak, speakScript, speechSupported, stopSpeaking } from '../lib/speech.ts';
import { Button } from './ui.tsx';

const Unsupported = () => (
  <span className="text-xs text-slate-500">Trình duyệt không hỗ trợ đọc. Hãy dùng Chrome hoặc Edge.</span>
);

export function SpeakButton({ text, lang, label = 'Nghe' }: { text: string; lang: string; label?: string }) {
  useEffect(() => stopSpeaking, []);
  if (!speechSupported) return <Unsupported />;
  return (
    <Button variant="secondary" onClick={() => speak(text, lang)}>
      ▶ {label}
    </Button>
  );
}

function readPlays(key?: string): number {
  if (!key) return 0;
  try {
    return Number(sessionStorage.getItem(key) ?? 0) || 0;
  } catch {
    return 0;
  }
}

function writePlays(key: string | undefined, n: number) {
  if (!key) return;
  try {
    sessionStorage.setItem(key, String(n));
  } catch {
    // Storage blocked: the limit then only holds until the page reloads.
  }
}

/**
 * Plays a listening script with one voice per speaker. With `maxPlays` (exam
 * mode, like the real TOEIC) the recording can only be played that many times.
 */
export function ListenPlayer({
  script,
  lang,
  maxPlays,
  storageKey,
}: {
  script: string;
  lang: string;
  maxPlays?: number;
  storageKey?: string;
}) {
  const [plays, setPlays] = useState(() => readPlays(storageKey));
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState(0.95);
  useEffect(() => stopSpeaking, []);

  if (!speechSupported) return <Unsupported />;
  const left = maxPlays === undefined ? null : Math.max(0, maxPlays - plays);

  const play = () => {
    if (!speakScript(script, lang, rate, () => setPlaying(false))) return;
    setPlaying(true);
    setPlays(plays + 1);
    writePlays(storageKey, plays + 1);
  };
  const stop = () => {
    stopSpeaking();
    setPlaying(false);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {playing ? (
        <Button variant="secondary" onClick={stop}>
          ■ Dừng
        </Button>
      ) : (
        <Button variant="secondary" onClick={play} disabled={left === 0}>
          ▶ {plays > 0 && left === null ? 'Nghe lại' : 'Nghe'}
        </Button>
      )}
      {left === null ? (
        <label className="flex items-center gap-1 text-xs text-slate-600">
          Tốc độ
          <select
            className="rounded border border-slate-300 px-1 py-0.5"
            value={rate}
            onChange={(e) => setRate(Number(e.target.value))}
          >
            <option value={0.8}>Chậm</option>
            <option value={0.95}>Vừa</option>
            <option value={1.05}>Như thi thật</option>
          </select>
        </label>
      ) : (
        <span className="text-xs text-slate-600">
          {left > 0 ? `Còn ${left} lượt nghe` : 'Đã hết lượt nghe'}
        </span>
      )}
    </div>
  );
}
