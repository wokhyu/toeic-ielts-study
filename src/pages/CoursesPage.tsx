import { Link } from 'react-router-dom';
import { EnrollButton } from '../components/EnrollmentGate.tsx';
import { Card, PageHeader } from '../components/ui.tsx';
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

export function CoursesPage() {
  const { session, courses, enrollmentFor, isAdmin } = useAuth();
  const list = courses.length > 0 ? courses : FALLBACK;

  return (
    <div>
      <PageHeader
        title="Khóa học"
        subtitle={
          session
            ? 'Gửi yêu cầu vào khóa học. Quản trị viên duyệt xong là bạn vào học được.'
            : 'Đăng ký tài khoản để gửi yêu cầu vào khóa học.'
        }
      />
      <div className="grid gap-4 md:grid-cols-3">
        {list.map((c) => {
          const approved = isAdmin || enrollmentFor(c.id)?.status === 'approved';
          return (
            <Card key={c.id} className="flex flex-col">
              <h2 className="text-lg font-semibold">{c.title}</h2>
              <p className="mt-1 flex-1 text-sm text-slate-600">{c.description}</p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                {session && approved && (
                  <Link
                    to={enterPath(c.id)}
                    className="rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white"
                  >
                    Vào học
                  </Link>
                )}
                {session && !isAdmin && <EnrollButton course={c.id} />}
                {!session && (
                  <Link to="/dang-ky" className="text-sm font-medium text-indigo-700 underline">
                    Đăng ký để học
                  </Link>
                )}
                {c.kind === 'roadmap' && (
                  <Link to={`/xem-truoc/${c.id}/lo-trinh`} className="text-sm text-slate-600 underline">
                    Xem trước lộ trình
                  </Link>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
