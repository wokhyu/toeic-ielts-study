import { useCallback } from 'react';
import { Badge, Card, ErrorBox, Spinner } from '../../components/ui.tsx';
import { formatDateVN } from '../../lib/dates.ts';
import { db } from '../../lib/supabase.ts';
import { unwrap, useAsync } from '../../lib/useAsync.ts';
import { useAuth } from '../../lib/auth-context.ts';
import { useRoadmap } from './context.ts';

interface Row {
  user_id: string;
  display_name: string;
  track: string | null;
  tasks_done: number;
  active_days: number;
  streak: number;
  last_active: string | null;
}

export function LeaderboardPage() {
  const { program } = useRoadmap();
  const { session } = useAuth();
  const load = useCallback(
    async () => unwrap(await db().rpc('get_leaderboard', { p_course: program })) as Row[],
    [program],
  );
  const { data, loading, error } = useAsync(load);

  if (loading) return <Spinner />;
  if (error) return <ErrorBox message={error} />;

  return (
    <Card className="overflow-x-auto">
      <p className="mb-3 text-sm text-slate-600">
        Xếp theo chuỗi ngày học liên tiếp (streak), sau đó theo số nhiệm vụ đã xong. Chỉ tính thành viên đã
        được duyệt vào khóa.
      </p>
      <table className="w-full text-left text-sm">
        <thead className="text-slate-500">
          <tr>
            <th className="p-2">#</th>
            <th className="p-2">Thành viên</th>
            <th className="p-2">Nhánh</th>
            <th className="p-2">Streak</th>
            <th className="p-2">Nhiệm vụ</th>
            <th className="p-2">Ngày học</th>
            <th className="p-2">Gần nhất</th>
          </tr>
        </thead>
        <tbody>
          {(data ?? []).map((r, i) => (
            <tr
              key={r.user_id}
              className={`border-t border-slate-100 ${r.user_id === session?.user.id ? 'bg-indigo-50' : ''}`}
            >
              <td className="p-2">{i + 1}</td>
              <td className="p-2 font-medium">{r.display_name}</td>
              <td className="p-2">{r.track ?? '—'}</td>
              <td className="p-2">
                <Badge color={r.streak > 0 ? 'yellow' : 'gray'}>🔥 {r.streak}</Badge>
              </td>
              <td className="p-2">{r.tasks_done}</td>
              <td className="p-2">{r.active_days}</td>
              <td className="p-2">{r.last_active ? formatDateVN(r.last_active) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
