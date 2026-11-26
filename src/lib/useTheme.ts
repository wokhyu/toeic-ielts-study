import { useCallback, useEffect, useState } from 'react';
import {
  applyTheme,
  readStoredTheme,
  resolveTheme,
  storeTheme,
  systemPrefersDark,
  type Theme,
} from './theme.ts';

export function useTheme(): { theme: Theme; toggle(): void } {
  const [theme, setTheme] = useState<Theme>(() => resolveTheme(readStoredTheme(), systemPrefersDark()));

  useEffect(() => applyTheme(theme), [theme]);

  // Follow the system setting until the learner picks one.
  useEffect(() => {
    if (typeof matchMedia !== 'function') return;
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      if (!readStoredTheme()) setTheme(mq.matches ? 'dark' : 'light');
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const toggle = useCallback(() => {
    setTheme((t) => {
      const next = t === 'dark' ? 'light' : 'dark';
      storeTheme(next);
      return next;
    });
  }, []);

  return { theme, toggle };
}
