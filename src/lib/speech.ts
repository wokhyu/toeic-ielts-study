export const speechSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;

export interface ScriptLine {
  speaker: string | null;
  text: string;
}

const SPEAKER = /^([A-Z][A-Za-z]*(?: [A-Z][A-Za-z]*)?)\s*:\s*(.+)$/;

/**
 * Splits a listening script into lines. "Man: Hello" becomes
 * { speaker: 'Man', text: 'Hello' }; lines without a label keep the previous speaker.
 */
export function parseScript(script: string): ScriptLine[] {
  const lines: ScriptLine[] = [];
  let speaker: string | null = null;
  for (const raw of script.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const m = SPEAKER.exec(line);
    if (m) {
      speaker = m[1];
      lines.push({ speaker, text: m[2] });
    } else {
      lines.push({ speaker, text: line });
    }
  }
  return lines;
}

const FEMALE =
  /female|woman|zira|susan|hazel|libby|sonia|aria|jenny|samantha|karen|moira|tessa|serena|emma|olivia/i;
const MALE = /\bmale|\bman\b|david|mark|george|ryan|guy|daniel|alex|fred|thomas|james|brian|oliver/i;
const FEMALE_ROLES = /^(woman|w|receptionist|she|mrs|ms|miss)\b/i;
const MALE_ROLES = /^(man|m|he|mr)\b/i;

/**
 * Chooses one voice per speaker: women's roles get a voice whose name sounds
 * female, men's roles one that sounds male, everyone else the next unused voice.
 */
export function pickVoices<V extends { name: string; lang: string }>(
  speakers: (string | null)[],
  voices: V[],
  lang: string,
): Map<string | null, V | undefined> {
  const exact = voices.filter((v) => v.lang === lang);
  const pool = exact.length > 0 ? exact : voices.filter((v) => v.lang.startsWith(lang.slice(0, 2)));
  const used = new Set<V>();
  const result = new Map<string | null, V | undefined>();
  for (const speaker of speakers) {
    if (result.has(speaker)) continue;
    const wanted =
      speaker && FEMALE_ROLES.test(speaker) ? FEMALE : speaker && MALE_ROLES.test(speaker) ? MALE : null;
    const voice =
      (wanted &&
        (pool.find((v) => wanted.test(v.name) && !used.has(v)) ?? pool.find((v) => wanted.test(v.name)))) ||
      pool.find((v) => !used.has(v)) ||
      pool[0];
    if (voice) used.add(voice);
    result.set(speaker, voice);
  }
  return result;
}

export function stopSpeaking() {
  if (speechSupported) window.speechSynthesis.cancel();
}

/**
 * Reads a script aloud with a different voice per speaker. `onEnd` runs after
 * the last line (or when speech stops). Returns false when speech is unavailable.
 */
export function speakScript(script: string, lang: string, rate = 0.95, onEnd?: () => void): boolean {
  if (!speechSupported) return false;
  const synth = window.speechSynthesis;
  synth.cancel();
  const lines = parseScript(script);
  if (lines.length === 0) return false;
  const voices = pickVoices(
    lines.map((l) => l.speaker),
    synth.getVoices(),
    lang,
  );
  lines.forEach((line, i) => {
    const u = new SpeechSynthesisUtterance(line.text);
    u.lang = lang;
    u.rate = rate;
    const voice = voices.get(line.speaker);
    if (voice) u.voice = voice;
    if (i === lines.length - 1 && onEnd) {
      u.onend = onEnd;
      u.onerror = onEnd;
    }
    synth.speak(u);
  });
  return true;
}

/** Reads text aloud (one voice). Speaker labels are skipped. */
export function speak(text: string, lang: string, rate = 0.95) {
  return speakScript(text, lang, rate);
}
