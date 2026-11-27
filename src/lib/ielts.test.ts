import { describe, expect, it } from 'vitest';
import { clock, formatBand, ieltsRound, wordCount } from './ielts.ts';

describe('ielts helpers', () => {
  it('counts words like the database', () => {
    expect(wordCount('  Cities  grow\nfast, and roads\tdo not. ')).toBe(7);
    expect(wordCount('   ')).toBe(0);
    expect(wordCount('one')).toBe(1);
  });

  it('rounds mean bands the IELTS way', () => {
    expect(ieltsRound(5.625)).toBe(5.5);
    expect(ieltsRound(6.25)).toBe(6.5);
    expect(ieltsRound(6.75)).toBe(7);
    expect(ieltsRound(6.125)).toBe(6);
    expect(formatBand(6)).toBe('6.0');
    expect(formatBand(null)).toBe('—');
  });

  it('formats a clock', () => {
    expect(clock(0)).toBe('0:00');
    expect(clock(125)).toBe('2:05');
  });
});
