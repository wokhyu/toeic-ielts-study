import { useCallback, useEffect, useState } from 'react';
import { errorMessage } from './supabase.ts';

export interface AsyncState<T> {
  loading: boolean;
  data: T | undefined;
  error: string | null;
  reload(): void;
}

interface Done<T> {
  fn: unknown;
  tick: number;
  data: T | undefined;
  error: string | null;
}

/** Runs `fn` on mount and whenever it changes. Wrap `fn` in useCallback. */
export function useAsync<T>(fn: () => Promise<T>): AsyncState<T> {
  const [tick, setTick] = useState(0);
  const [done, setDone] = useState<Done<T> | null>(null);

  useEffect(() => {
    let cancelled = false;
    fn().then(
      (data) => {
        if (!cancelled) setDone({ fn, tick, data, error: null });
      },
      (e: unknown) => {
        if (!cancelled) setDone({ fn, tick, data: undefined, error: errorMessage(e) });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [fn, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  // Loading until the result belongs to the current `fn` and reload tick; earlier data stays visible.
  const loading = !done || done.fn !== fn || done.tick !== tick;
  return { loading, data: done?.data, error: loading ? null : (done?.error ?? null), reload };
}

/** Throws the Supabase error, otherwise returns the data. */
export function unwrap<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}
