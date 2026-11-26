import { afterEach, describe, expect, it, vi } from 'vitest';
import { readStoredTheme, resolveTheme, storeTheme } from './theme.ts';

describe('theme', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('follows the system until the learner chooses', () => {
    expect(resolveTheme(null, false)).toBe('light');
    expect(resolveTheme(null, true)).toBe('dark');
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
    expect(resolveTheme('purple', true)).toBe('dark');
  });

  it('keeps working when storage is blocked', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    });
    expect(readStoredTheme()).toBeNull();
    expect(() => storeTheme('dark')).not.toThrow();
  });

  it('reads back a stored choice and ignores junk', () => {
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, v),
    });
    expect(readStoredTheme()).toBeNull();
    storeTheme('dark');
    expect(readStoredTheme()).toBe('dark');
    store.set('theme', 'neon');
    expect(readStoredTheme()).toBeNull();
  });
});
