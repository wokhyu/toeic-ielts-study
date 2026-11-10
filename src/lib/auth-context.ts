import type { Session } from '@supabase/supabase-js';
import { createContext, useContext } from 'react';
import type { Course, CourseId, Enrollment, Profile } from './types.ts';

export interface AuthState {
  loading: boolean;
  session: Session | null;
  profile: Profile | null;
  courses: Course[];
  enrollments: Enrollment[];
  isAdmin: boolean;
  enrollmentFor(course: CourseId): Enrollment | undefined;
  refresh(): Promise<void>;
  signOut(): Promise<void>;
}

export const AuthContext = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
