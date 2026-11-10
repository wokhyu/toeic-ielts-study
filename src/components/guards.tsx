import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth-context.ts';
import type { CourseId } from '../lib/types.ts';
import { EnrollmentGate } from './EnrollmentGate.tsx';
import { Spinner } from './ui.tsx';

export function RequireAuth({ children }: { children: ReactNode }) {
  const { loading, session } = useAuth();
  const location = useLocation();
  if (loading) return <Spinner />;
  if (!session) return <Navigate to="/dang-nhap" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { loading, isAdmin } = useAuth();
  if (loading) return <Spinner />;
  if (!isAdmin) return <Navigate to="/khoa-hoc" replace />;
  return <>{children}</>;
}

/** Course pages: only for approved learners (and admins). */
export function RequireCourse({ course, children }: { course: CourseId; children: ReactNode }) {
  const { loading, isAdmin, enrollmentFor } = useAuth();
  if (loading) return <Spinner />;
  const e = enrollmentFor(course);
  if (isAdmin || e?.status === 'approved') return <>{children}</>;
  return <EnrollmentGate course={course} />;
}
