import { useCallback, useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import type { Program, Track } from '../../content/schema.ts';
import { db, errorMessage, supabase } from '../../lib/supabase.ts';
import type { Enrollment } from '../../lib/types.ts';

export interface RoadmapContext {
  program: Program;
  title: string;
  /** Null until the learner is placed into a track. */
  track: Track | null;
  startDate: string | null;
  enrollment: Enrollment | undefined;
  /** Preview without an account, or an admin browsing a course they are not enrolled in. */
  preview: boolean;
  setPreviewTrack(track: Track): void;
}

export function useRoadmap(): RoadmapContext {
  return useOutletContext<RoadmapContext>();
}

/** The learner's completed task ids for one course, with optimistic toggling. */
export function useTaskProgress(program: Program, enabled: boolean) {
  const [done, setDone] = useState<Map<string, string>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(enabled);

  useEffect(() => {
    if (!enabled || !supabase) return;
    let cancelled = false;
    void (async () => {
      const { data: session } = await db().auth.getSession();
      const userId = session.session?.user.id;
      const { data, error: err } = await db()
        .from('task_progress')
        .select('task_id, completed_at')
        .eq('course_id', program)
        .eq('user_id', userId ?? '');
      if (cancelled) return;
      if (err) setError(errorMessage(err));
      else setDone(new Map((data ?? []).map((r) => [r.task_id as string, r.completed_at as string])));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [program, enabled]);

  const toggle = useCallback(
    async (taskId: string) => {
      if (!enabled) return;
      const wasDone = done.has(taskId);
      setDone((m) => {
        const next = new Map(m);
        if (wasDone) next.delete(taskId);
        else next.set(taskId, new Date().toISOString());
        return next;
      });
      const res = wasDone
        ? await db().from('task_progress').delete().eq('task_id', taskId)
        : await db().from('task_progress').insert({ course_id: program, task_id: taskId });
      if (res.error) {
        setError(errorMessage(res.error));
        setDone((m) => {
          const next = new Map(m);
          if (wasDone) next.set(taskId, new Date().toISOString());
          else next.delete(taskId);
          return next;
        });
      }
    },
    [done, enabled, program],
  );

  return { done, toggle, error, loading };
}
