export const speechSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;

/** Reads text aloud with the browser's speech synthesis (used for Listening scripts). */
export function speak(text: string, lang: string, rate = 0.95) {
  if (!speechSupported) return false;
  window.speechSynthesis.cancel();
  const voices = window.speechSynthesis.getVoices();
  // Scripts mark speakers as "Man:" / "Woman:"; read only the spoken words.
  const clean = text.replace(/^(Man|Woman|Receptionist|Caller|Lecturer)\s*:\s*/gm, '');
  const u = new SpeechSynthesisUtterance(clean);
  u.lang = lang;
  u.rate = rate;
  const voice =
    voices.find((v) => v.lang === lang) ?? voices.find((v) => v.lang.startsWith(lang.slice(0, 2)));
  if (voice) u.voice = voice;
  window.speechSynthesis.speak(u);
  return true;
}
