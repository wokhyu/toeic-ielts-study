import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Button, Card, ErrorBox, inputClass, PageHeader, Spinner } from '../../components/ui.tsx';
import { useAuth } from '../../lib/auth-context.ts';
import { formatDateVN, toDateVN } from '../../lib/dates.ts';
import { db, errorMessage } from '../../lib/supabase.ts';
import { STATUS_LABEL, type AdminUserRow, type CourseId, type EnrollmentStatus } from '../../lib/types.ts';
import { unwrap, useAsync } from '../../lib/useAsync.ts';

const STATUS_COLOR: Record<EnrollmentStatus, 'green' | 'yellow' | 'red' | 'gray'> = {
  approved: 'green',
  pending: 'yellow',
  rejected: 'red',
  revoked: 'gray',
};

export function AdminUsersPage() {
  const { courses } = useAuth();
  const load = useCallback(async () => unwrap(await db().rpc('admin_list_users')) as AdminUserRow[], []);
  const { data, loading, error, reload } = useAsync(load);
  const [query, setQuery] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const courseTitle = (id: string) => courses.find((c) => c.id === id)?.title ?? id;

  const pending = useMemo(
    () =>
      (data ?? []).flatMap((u) =>
        u.enrollments.filter((e) => e.status === 'pending').map((e) => ({ user: u, enrollment: e })),
      ),
    [data],
  );

  const filtered = (data ?? []).filter((u) =>
    `${u.email} ${u.display_name}`.toLowerCase().includes(query.trim().toLowerCase()),
  );

  const decide = async (userId: string, course: CourseId, status: EnrollmentStatus) => {
    setActionError(null);
    const { error: err } = await db().rpc('admin_set_enrollment', {
      p_user: userId,
      p_course: course,
      p_status: status,
    });
    if (err) setActionError(errorMessage(err));
    reload();
  };

  if (loading) return <Spinner />;
  if (error) return <ErrorBox message={error} />;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Quản trị"
        subtitle={`${data?.length ?? 0} tài khoản · ${pending.length} yêu cầu chờ duyệt`}
        actions={
          <Link
            to="/admin/duyet-dap-an"
            className="rounded-lg bg-white px-3 py-2 text-sm font-medium ring-1 ring-slate-300"
          >
            Duyệt đáp án on-tap-11
          </Link>
        }
      />
      {actionError && <ErrorBox message={actionError} />}

      <Card>
        <h2 className="mb-3 font-semibold">Yêu cầu chờ duyệt</h2>
        {pending.length === 0 ? (
          <p className="text-sm text-slate-500">Không có yêu cầu nào.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {pending.map(({ user, enrollment }) => (
              <li
                key={`${user.id}-${enrollment.course_id}`}
                className="flex flex-wrap items-center gap-3 py-2.5 text-sm"
              >
                <div className="flex-1">
                  <Link
                    to={`/admin/nguoi-dung/${user.id}`}
                    className="font-medium text-indigo-700 hover:underline"
                  >
                    {user.display_name}
                  </Link>{' '}
                  <span className="text-slate-500">{user.email}</span>
                  <div className="text-slate-600">
                    {courseTitle(enrollment.course_id)} · gửi{' '}
                    {formatDateVN(toDateVN(enrollment.requested_at))}
                  </div>
                </div>
                <Button onClick={() => void decide(user.id, enrollment.course_id, 'approved')}>Duyệt</Button>
                <Button
                  variant="secondary"
                  onClick={() => void decide(user.id, enrollment.course_id, 'rejected')}
                >
                  Từ chối
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="overflow-x-auto">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <h2 className="font-semibold">Người dùng</h2>
          <input
            className={`${inputClass} max-w-xs`}
            placeholder="Tìm theo tên hoặc email"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="text-slate-500">
            <tr>
              <th className="p-2">Tên</th>
              <th className="p-2">Email</th>
              <th className="p-2">Vai trò</th>
              <th className="p-2">Khóa học</th>
              <th className="p-2">Đăng nhập gần nhất</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={u.id} className="border-t border-slate-100 align-top">
                <td className="p-2">
                  <Link
                    to={`/admin/nguoi-dung/${u.id}`}
                    className="font-medium text-indigo-700 hover:underline"
                  >
                    {u.display_name || '(chưa đặt tên)'}
                  </Link>
                </td>
                <td className="p-2 text-slate-600">{u.email}</td>
                <td className="p-2">{u.role === 'admin' ? <Badge color="blue">Admin</Badge> : 'Học viên'}</td>
                <td className="p-2">
                  <div className="flex flex-wrap gap-1">
                    {u.enrollments.length === 0 && <span className="text-slate-400">—</span>}
                    {u.enrollments.map((e) => (
                      <Badge key={e.course_id} color={STATUS_COLOR[e.status]}>
                        {e.course_id}
                        {e.track ? ` · ${e.track}` : ''} · {STATUS_LABEL[e.status]}
                      </Badge>
                    ))}
                  </div>
                </td>
                <td className="p-2 text-slate-600">
                  {u.last_sign_in_at ? formatDateVN(toDateVN(u.last_sign_in_at)) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
