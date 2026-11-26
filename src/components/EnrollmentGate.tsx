import { useState } from 'react';
import { useAuth } from '../lib/auth-context.ts';
import { db, errorMessage } from '../lib/supabase.ts';
import { STATUS_LABEL, type CourseId } from '../lib/types.ts';
import { Mascot } from './art/Mascot.tsx';
import { Badge, Button, Card, ErrorBox } from './ui.tsx';

export function EnrollButton({ course }: { course: CourseId }) {
  const { enrollmentFor, refresh } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const e = enrollmentFor(course);

  if (e?.status === 'approved') return <Badge color="green">{STATUS_LABEL.approved}</Badge>;
  if (e?.status === 'pending') return <Badge color="yellow">{STATUS_LABEL.pending}</Badge>;

  const request = async () => {
    setBusy(true);
    setError(null);
    const { error: err } = await db().rpc('request_enrollment', { p_course: course });
    if (err) setError(errorMessage(err));
    await refresh();
    setBusy(false);
  };

  return (
    <div className="flex flex-col items-start gap-2">
      {e && <Badge color="red">{STATUS_LABEL[e.status]}</Badge>}
      <Button onClick={() => void request()} disabled={busy}>
        {e ? 'Gửi lại yêu cầu' : 'Đăng ký khóa học'}
      </Button>
      {error && <ErrorBox message={error} />}
    </div>
  );
}

export function EnrollmentGate({ course }: { course: CourseId }) {
  const { courses, enrollmentFor } = useAuth();
  const info = courses.find((c) => c.id === course);
  const e = enrollmentFor(course);
  return (
    <Card className="flex max-w-xl items-start gap-4">
      <Mascot mood={e?.status === 'pending' ? 'sleepy' : 'thinking'} size={72} decorative />
      <div>
        <h1 className="text-lg font-semibold">{info?.title ?? course}</h1>
        <p className="mt-1 text-sm text-ink-soft">
          {e?.status === 'pending'
            ? 'Yêu cầu của bạn đã được gửi và đang chờ quản trị viên duyệt. Bé Cú sẽ mở cửa ngay khi được duyệt nhé!'
            : 'Bạn chưa được duyệt vào khóa học này. Gửi yêu cầu để quản trị viên xem xét.'}
        </p>
        <div className="mt-4">
          <EnrollButton course={course} />
        </div>
      </div>
    </Card>
  );
}
