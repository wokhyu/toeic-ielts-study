import { useEffect } from 'react';
import { speak, speechSupported } from '../lib/speech.ts';
import { Button } from './ui.tsx';

export function SpeakButton({ text, lang, label = 'Nghe' }: { text: string; lang: string; label?: string }) {
  useEffect(
    () => () => {
      if (speechSupported) window.speechSynthesis.cancel();
    },
    [],
  );
  if (!speechSupported)
    return (
      <span className="text-xs text-slate-500">Trình duyệt không hỗ trợ đọc. Hãy dùng Chrome/Edge.</span>
    );
  return (
    <Button variant="secondary" onClick={() => speak(text, lang)}>
      ▶ {label}
    </Button>
  );
}
