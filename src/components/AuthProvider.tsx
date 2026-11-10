import type { Session } from '@supabase/supabase-js';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AuthContext, type AuthState } from '../lib/auth-context.ts';
import { supabase } from '../lib/supabase.ts';
import type { Course, CourseId, Enrollment, Profile } from '../lib/types.ts';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(Boolean(supabase));

  const load = useCallback(async (s: Session | null) => {
    if (!supabase || !s) {
      setProfile(null);
      setEnrollments([]);
      setCourses([]);
      setLoading(false);
      return;
    }
    const [p, c, e] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', s.user.id).maybeSingle(),
      supabase.from('courses').select('*').order('sort'),
      supabase.from('enrollments').select('*').eq('user_id', s.user.id),
    ]);
    setProfile((p.data as Profile | null) ?? null);
    setCourses((c.data as Course[] | null) ?? []);
    setEnrollments((e.data as Enrollment[] | null) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      void load(data.session);
    });
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === 'PASSWORD_RECOVERY') window.location.hash = '#/doi-mat-khau';
      // Defer the queries: supabase-js forbids awaiting other calls inside this callback.
      setTimeout(() => void load(s), 0);
    });
    return () => data.subscription.unsubscribe();
  }, [load]);

  const value = useMemo<AuthState>(
    () => ({
      loading,
      session,
      profile,
      courses,
      enrollments,
      isAdmin: profile?.role === 'admin',
      enrollmentFor: (course: CourseId) => enrollments.find((e) => e.course_id === course),
      refresh: () => load(session),
      signOut: async () => {
        await supabase?.auth.signOut();
      },
    }),
    [loading, session, profile, courses, enrollments, load],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
