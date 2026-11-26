import type { CourseId } from '../lib/types.ts';

/**
 * Badges a learner can earn. The rules are evaluated in SQL by
 * learner_achievements(); a test checks that the ids here match.
 */
export interface BadgeDef {
  id: string;
  name: string;
  description: string;
  /** Emoji shown on the badge. */
  icon: string;
  /** Courses where the badge can be earned (roadmap-only ones need flashcards, tasks or mock tests). */
  courses: CourseId[];
}

const ALL: CourseId[] = ['toeic', 'ielts', 'on-tap-11'];
const ROADMAP: CourseId[] = ['toeic', 'ielts'];

export const BADGES: BadgeDef[] = [
  { id: 'first-step', name: 'Bước đầu tiên', description: 'Trả lời câu hỏi đầu tiên.', icon: '🐣', courses: ALL },
  { id: 'correct-100', name: 'Trăm câu đúng', description: 'Trả lời đúng 100 câu.', icon: '💯', courses: ALL },
  { id: 'correct-500', name: 'Năm trăm câu đúng', description: 'Trả lời đúng 500 câu.', icon: '🏅', courses: ALL },
  { id: 'streak-7', name: 'Một tuần chăm chỉ', description: 'Học 7 ngày liên tiếp.', icon: '🔥', courses: ALL },
  { id: 'streak-30', name: 'Một tháng bền bỉ', description: 'Học 30 ngày liên tiếp.', icon: '🌟', courses: ALL },
  {
    id: 'week-done',
    name: 'Xong một tuần',
    description: 'Hoàn thành mọi nhiệm vụ của một tuần trong lộ trình.',
    icon: '📅',
    courses: ROADMAP,
  },
  { id: 'cards-100', name: 'Trăm lần lật thẻ', description: 'Ôn 100 lượt flashcard.', icon: '🃏', courses: ROADMAP },
  {
    id: 'first-mock',
    name: 'Thi thử đầu tiên',
    description: 'Làm xong một đề thi thử trên web.',
    icon: '📝',
    courses: ROADMAP,
  },
  {
    id: 'level-up',
    name: 'Lên trình',
    description: 'Điểm thi thử mới nhất cao hơn lần đầu 50 điểm TOEIC hoặc 0,5 band IELTS.',
    icon: '🚀',
    courses: ROADMAP,
  },
  {
    id: 'part-master',
    name: 'Thạo một phần',
    description: 'Đúng từ 80% trở lên trên ít nhất 40 câu của một Part hoặc một chương.',
    icon: '🎯',
    courses: ALL,
  },
  {
    id: 'review-10',
    name: 'Sửa sai',
    description: 'Ôn lại 10 câu từng làm sai cho tới khi đúng 3 lần liền.',
    icon: '🔁',
    courses: ALL,
  },
];

export function badgesFor(course: CourseId): BadgeDef[] {
  return BADGES.filter((b) => b.courses.includes(course));
}
