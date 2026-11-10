import type { Track } from '../content/schema.ts';

export type Role = 'learner' | 'admin';
export type EnrollmentStatus = 'pending' | 'approved' | 'rejected' | 'revoked';
export type CourseId = 'toeic' | 'ielts' | 'on-tap-11';

export interface Course {
  id: CourseId;
  title: string;
  description: string;
  kind: 'roadmap' | 'question_bank';
  sort: number;
}

export interface Profile {
  id: string;
  display_name: string;
  role: Role;
  created_at: string;
}

export interface Enrollment {
  user_id: string;
  course_id: CourseId;
  status: EnrollmentStatus;
  track: Track | null;
  start_date: string | null;
  requested_at: string;
  decided_at: string | null;
}

export interface MockScore {
  id: number;
  user_id: string;
  course_id: CourseId;
  week: number | null;
  listening: number | null;
  reading: number | null;
  writing: number | null;
  speaking: number | null;
  total: number;
  taken_at: string;
}

export interface PlacementResult {
  id: number;
  course_id: CourseId;
  source: 'test' | 'real_score';
  correct_count: number | null;
  total: number | null;
  real_score: number | null;
  track: Track;
  taken_at: string;
}

export interface FlashcardReview {
  card_id: string;
  course_id: CourseId;
  ease: number;
  interval_days: number;
  reps: number;
  due_date: string;
  last_reviewed_at: string;
}

export interface AdminUserRow {
  id: string;
  email: string;
  display_name: string;
  role: Role;
  created_at: string;
  last_sign_in_at: string | null;
  enrollments: Pick<Enrollment, 'course_id' | 'status' | 'track' | 'start_date' | 'requested_at'>[];
}

export const STATUS_LABEL: Record<EnrollmentStatus, string> = {
  pending: 'Chờ duyệt',
  approved: 'Đã duyệt',
  rejected: 'Bị từ chối',
  revoked: 'Đã thu hồi',
};

/** First page of a course once the learner is approved. */
export function enterPath(course: CourseId): string {
  return course === 'on-tap-11' ? '/c/on-tap-11' : `/c/${course}/hom-nay`;
}
