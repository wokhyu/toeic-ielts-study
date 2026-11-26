import { useSearchParams } from 'react-router-dom';
import type { CourseId } from '../../lib/types.ts';

export const ADMIN_COURSES: { id: CourseId; label: string }[] = [
  { id: 'toeic', label: 'TOEIC' },
  { id: 'ielts', label: 'IELTS' },
  { id: 'on-tap-11', label: 'Ôn tập 11' },
];

/** The course picked in the admin area, kept in the URL (?khoa=…) so links and reloads keep it. */
export function useAdminCourse(allowAll: boolean): [CourseId | null, (c: CourseId | null) => void] {
  const [params, setParams] = useSearchParams();
  const raw = params.get('khoa');
  const valid = ADMIN_COURSES.some((c) => c.id === raw) ? (raw as CourseId) : null;
  const course = valid ?? (allowAll ? null : 'toeic');
  const set = (c: CourseId | null) =>
    setParams(
      (p) => {
        if (c) p.set('khoa', c);
        else p.delete('khoa');
        return p;
      },
      { replace: true },
    );
  return [course, set];
}
