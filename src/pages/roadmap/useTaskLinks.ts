import { useCallback } from 'react';
import type { Program } from '../../content/schema.ts';
import { loadMockTests } from '../../features/bank/data.ts';
import { db } from '../../lib/supabase.ts';
import { bankBase } from '../../lib/types.ts';
import { unwrap, useAsync } from '../../lib/useAsync.ts';

/** What TaskList needs to show "Làm ngay" buttons. */
export interface TaskLinks {
  /** Route prefix of the course's question bank. */
  base: string;
  /** Answers given so far for each practice task. */
  answered: ReadonlyMap<string, number>;
  /** Weeks that have a mock test on the site. */
  mockWeeks: ReadonlySet<number>;
}

/** Undefined while loading, in preview, or if the bank cannot be reached (then no buttons show). */
export function useTaskLinks(program: Program, enabled: boolean): TaskLinks | undefined {
  const load = useCallback(async (): Promise<TaskLinks | undefined> => {
    if (!enabled) return undefined;
    const [counts, mocks] = await Promise.all([
      db().rpc('ot_task_answer_counts', { p_course: program }),
      loadMockTests(program),
    ]);
    const rows = unwrap(counts) as { task_id: string; answered: number }[];
    return {
      base: bankBase(program),
      answered: new Map(rows.map((r) => [r.task_id, r.answered])),
      mockWeeks: new Set(mocks.flatMap((m) => (m.week === null ? [] : [m.week]))),
    };
  }, [program, enabled]);
  return useAsync(load).data ?? undefined;
}
