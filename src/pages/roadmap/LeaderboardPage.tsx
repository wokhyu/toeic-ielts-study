import { useCallback } from 'react';
import { Badge, Card, ErrorBox, Spinner } from '../../components/ui.tsx';
import { formatDateVN } from '../../lib/dates.ts';
import { db } from '../../lib/supabase.ts';
import { unwrap, useAsync } from '../../lib/useAsync.ts';
import { useAuth } from '../../lib/auth-context.ts';
import { useRoadmap } from './context.ts';
import { IconFlame } from '../../components/icons.tsx';

interface Row {
  user_id: string;
  display_name: string;
  track: string | null;
  tasks_done: number;
  active_days: number;
  streak: number;
  last_active: string | null;
  badges: number;
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
      <p className="mb-3 text-sm text-ink-soft">
        Xếp theo chuỗi ngày học liên tiếp (streak: ngày nào có làm câu hỏi, tích nhiệm vụ hoặc ôn thẻ đều
        tính), sau đó theo số nhiệm vụ đã xong. Chỉ tính thành viên đã được duyệt vào khóa.
      </p>
      <table className="w-full text-left text-sm">
        <thead className="text-ink-muted">
          <tr>
            <th className="p-2">#</th>
            <th className="p-2">Thành viên</th>
            <th className="p-2">Nhánh</th>
            <th className="p-2">Streak</th>
            <th className="p-2">Nhiệm vụ</th>
            <th className="p-2">Ngày học</th>
            <th className="p-2">Huy hiệu</th>
            <th className="p-2">Gần nhất</th>
          </tr>
        </thead>
        <tbody>
          {(data ?? []).map((r, i) => (
            <tr
              key={r.user_id}
              className={`border-t border-line ${r.user_id === session?.user.id ? 'bg-brand-soft' : ''}`}
            >
              <td className="p-2 font-semibold">
                {i < 3 ? (
                  <span
                    className={`grid h-7 w-7 place-items-center rounded-full text-xs ${
                      ['bg-butter text-ink', 'bg-muted text-ink', 'bg-accent-soft text-accent-ink'][i]
                    }`}
                    aria-label={`Hạng ${i + 1}`}
                  >
                    {i + 1}
                  </span>
                ) : (
                  i + 1
                )}
              </td>
              <td className="p-2 font-medium">{r.display_name}</td>
              <td className="p-2">{r.track ?? '—'}</td>
              <td className="p-2">
                <Badge color={r.streak > 0 ? 'coral' : 'gray'}>
                  <IconFlame size={13} /> {r.streak} ngày
                </Badge>
              </td>
              <td className="p-2">{r.tasks_done}</td>
              <td className="p-2">{r.active_days}</td>
              <td className="p-2">{r.badges > 0 ? `🏅 ${r.badges}` : '—'}</td>
              <td className="p-2">{r.last_active ? formatDateVN(r.last_active) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
