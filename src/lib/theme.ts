/**
 * Light/dark theme. With no saved choice the site follows the system setting;
 * a choice made with the header toggle is kept in localStorage. Storage can be
 * unavailable (private mode, blocked site data), so every access is guarded.
 * index.html applies the same rule before React loads, to avoid a flash.
 */
export type Theme = 'light' | 'dark';
export const THEME_KEY = 'theme';

export function resolveTheme(stored: string | null, prefersDark: boolean): Theme {
  if (stored === 'light' || stored === 'dark') return stored;
  return prefersDark ? 'dark' : 'light';
}

export function readStoredTheme(): Theme | null {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === 'light' || v === 'dark' ? v : null;
  } catch {
    return null;
  }
}

export function storeTheme(theme: Theme): void {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Not saved; the choice still applies until the page is reloaded.
  }
}

export function systemPrefersDark(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches;
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', theme === 'dark' ? '#15181e' : '#fbf7f0');
}

export function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}
