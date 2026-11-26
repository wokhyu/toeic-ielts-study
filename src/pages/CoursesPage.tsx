import { Link } from 'react-router-dom';
import { EnrollButton } from '../components/EnrollmentGate.tsx';
import { CourseArt } from '../components/art/CourseArt.tsx';
import { Mascot } from '../components/art/Mascot.tsx';
import { IconArrowRight } from '../components/icons.tsx';
import { buttonClass } from '../components/styles.ts';
import { Card } from '../components/ui.tsx';
import { useAuth } from '../lib/auth-context.ts';
import { enterPath, type Course } from '../lib/types.ts';

/** Shown before sign-in (or without Supabase) so the catalog is never empty. */
const FALLBACK: Course[] = [
  {
    id: 'toeic',
    title: 'TOEIC Listening & Reading',
    description: 'Lộ trình 12 tuần, 3 nhánh A/B/C, có bài test đầu vào, flashcard và thi thử.',
    kind: 'roadmap',
    sort: 1,
  },
  {
    id: 'ielts',
    title: 'IELTS Academic',
    description: 'Lộ trình 12 tuần luyện 4 kỹ năng, chấm chéo Writing và luyện Speaking theo cặp.',
    kind: 'roadmap',
    sort: 2,
  },
  {
    id: 'on-tap-11',
    title: 'Ôn tập Toán · Lý · Hóa 11',
    description: 'Ngân hàng câu hỏi theo chương: luyện tập từng chủ đề, thi thử có bấm giờ, ôn lại câu sai.',
    kind: 'question_bank',
    sort: 3,
  },
];

const TAGLINE: Record<string, string> = {
  toeic: 'Nghe & Đọc · 990 điểm',
  ielts: '4 kỹ năng · Band 9',
  'on-tap-11': 'Toán · Lý · Hóa',
};

export function CoursesPage() {
  const { session, profile, courses, enrollmentFor, isAdmin } = useAuth();
  const list = courses.length > 0 ? courses : FALLBACK;
  const name = profile?.display_name?.trim().split(/\s+/).pop();

  return (
    <div className="space-y-6">
      <Card variant="hero" className="flex items-center gap-4 overflow-hidden">
        <span className="animate-float">
          <Mascot mood={session ? 'cheer' : 'happy'} size={88} decorative />
        </span>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            {session ? `Chào ${name ?? 'bạn'}!` : 'Học nhóm cùng Bé Cú'}
          </h1>
          <p className="mt-1 text-sm text-ink-soft">
            {session
              ? 'Chọn khóa học để bắt đầu. Khóa mới cần quản trị viên duyệt trước khi vào học.'
              : 'Lộ trình TOEIC, IELTS và ngân hàng câu hỏi lớp 11. Đăng ký tài khoản để gửi yêu cầu vào khóa học.'}
          </p>
        </div>
      </Card>
      <div className="grid gap-5 md:grid-cols-3">
        {list.map((c) => {
          const approved = isAdmin || enrollmentFor(c.id)?.status === 'approved';
          return (
            <article
              key={c.id}
              className="group flex flex-col overflow-hidden rounded-[var(--radius-card)] bg-surface shadow-soft ring-1 ring-line transition hover:-translate-y-0.5 hover:shadow-lift"
            >
              <CourseArt course={c.id} className="h-28 w-full" />
              <div className="flex flex-1 flex-col p-5">
                <p className="text-xs font-medium tracking-wide text-accent-ink uppercase">{TAGLINE[c.id]}</p>
                <h2 className="mt-1 text-lg font-semibold text-ink">{c.title}</h2>
                <p className="mt-1 flex-1 text-sm text-ink-soft">{c.description}</p>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  {session && approved && (
                    <Link to={enterPath(c.id)} className={buttonClass('primary')}>
                      Vào học <IconArrowRight size={16} />
                    </Link>
                  )}
                  {session && !isAdmin && <EnrollButton course={c.id} />}
                  {!session && (
                    <Link to="/dang-ky" className={buttonClass('primary')}>
                      Đăng ký để học
                    </Link>
                  )}
                  {c.kind === 'roadmap' && (
                    <Link
                      to={`/xem-truoc/${c.id}/lo-trinh`}
                      className="text-sm font-medium text-brand-ink hover:underline"
                    >
                      Xem trước lộ trình
                    </Link>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
