import { describe, expect, it } from 'vitest';
import { groupByStimulus, hasAnswer, keyText, type Stimulus } from './bank.ts';
import { parseScript, pickVoices } from './speech.ts';

const stim = (id: number): Stimulus => ({ id, kind: 'audio', title: '', html: '', audio_script: 'Man: Hi' });

describe('groupByStimulus', () => {
  it('keeps questions of one recording together and numbers them in order', () => {
    const qs = [
      { id: 1, stimulus_id: null, stimulus: undefined },
      { id: 2, stimulus_id: 7, stimulus: stim(7) },
      { id: 3, stimulus_id: 7, stimulus: stim(7) },
      { id: 4, stimulus_id: 8, stimulus: stim(8) },
      { id: 5, stimulus_id: null, stimulus: undefined },
    ];
    const groups = groupByStimulus(qs);
    expect(groups.map((g) => [g.stimulus?.id ?? null, g.items.map((i) => i.index)])).toEqual([
      [null, [1]],
      [7, [2, 3]],
      [8, [4]],
      [null, [5]],
    ]);
  });
});

describe('answers', () => {
  it('needs a non-empty response except for essays', () => {
    expect(hasAnswer({ type: 'mcq' }, null)).toBe(false);
    expect(hasAnswer({ type: 'short' }, '  ')).toBe(false);
    expect(hasAnswer({ type: 'short' }, 'Harris')).toBe(true);
    expect(hasAnswer({ type: 'truefalse' }, { a: true })).toBe(true);
    expect(hasAnswer({ type: 'essay' }, null)).toBe(true);
  });

  it('shows every accepted short answer', () => {
    expect(keyText(['15 May', 'May 15'])).toBe('15 May / May 15');
    expect(keyText('B')).toBe('B');
    expect(keyText({ a: true })).toBeNull();
  });
});

describe('listening scripts', () => {
  it('splits a script into speakers', () => {
    expect(parseScript('Man: Is it ready?\nWoman: Not yet.\nIt should be done by noon.')).toEqual([
      { speaker: 'Man', text: 'Is it ready?' },
      { speaker: 'Woman', text: 'Not yet.' },
      { speaker: 'Woman', text: 'It should be done by noon.' },
    ]);
    expect(parseScript('Welcome to the museum tour.')).toEqual([
      { speaker: null, text: 'Welcome to the museum tour.' },
    ]);
  });

  it('gives men and women different voices of the right language', () => {
    const voices = [
      { name: 'Microsoft David - English (United States)', lang: 'en-US' },
      { name: 'Microsoft Zira - English (United States)', lang: 'en-US' },
      { name: 'Google UK English Female', lang: 'en-GB' },
    ];
    const us = pickVoices(['Man', 'Woman', 'Man'], voices, 'en-US');
    expect(us.get('Man')?.name).toMatch(/David/);
    expect(us.get('Woman')?.name).toMatch(/Zira/);
    const uk = pickVoices(['Woman'], voices, 'en-GB');
    expect(uk.get('Woman')?.lang).toBe('en-GB');
    const narrator = pickVoices([null], voices, 'en-AU');
    expect(narrator.get(null)?.lang.startsWith('en')).toBe(true);
  });
});
