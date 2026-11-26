import { useCallback, useState } from 'react';
import { IconCheck, IconX } from '../../components/icons.tsx';
import { Badge, Card, Chip, ErrorBox, InfoHint, Spinner } from '../../components/ui.tsx';
import { tagLabel } from '../../content/bank.ts';
import { roadmaps } from '../../content/index.ts';
import type { Program, Task, Track } from '../../content/schema.ts';
import { ProgressPage } from '../../features/progress/ProgressPage.tsx';
import { tasksFor } from '../../lib/roadmap.ts';
import { formatDuration } from '../../lib/stats.ts';
import { db } from '../../lib/supabase.ts';
import type { AdminUserRow, CourseId } from '../../lib/types.ts';
import { unwrap, useAsync } from '../../lib/useAsync.ts';

const COURSE_LABEL: Record<CourseId, string> = { toeic: 'TOEIC', ielts: 'IELTS', 'on-tap-11': 'Ôn tập 11' };

/**
 * Detailed analysis of one learner for the admin: the learner's own progress
 * tab, the roadmap as a week × skill grid, and their latest answers.
 */
export function LearnerInsights({ user, doneTasks }: { user: AdminUserRow; doneTasks: Set<string> }) {
  const approved = user.enrollments.filter((e) => e.status === 'approved');
  const [course, setCourse] = useState<CourseId | null>(approved[0]?.course_id ?? null);
  if (!course) return null;
  const enrollment = approved.find((e) => e.course_id === course);
  const roadmap = course !== 'on-tap-11';

  return (
    <section className="space-y-4" aria-labelledby="phan-tich">
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="phan-tich" className="mr-2 text-lg font-semibold text-ink">
          Phân tích học tập
        </h2>
        {approved.map((e) => (
          <Chip key={e.course_id} active={course === e.course_id} onClick={() => setCourse(e.course_id)}>
            {COURSE_LABEL[e.course_id]}
          </Chip>
        ))}
      </div>
      <ProgressPage key={course} course={course} userId={user.id} track={enrollment?.track ?? null} />
      {roadmap && enrollment?.track && (
        <WeekSkillGrid program={course} track={enrollment.track} done={doneTasks} />
      )}
      <RecentAnswers key={`answers-${course}`} userId={user.id} course={course} />
    </section>
  );
}

const SKILL_LABEL: Record<Task['skill'], string> = {
  listening: 'Nghe',
  reading: 'Đọc',
  writing: 'Viết',
  speaking: 'Nói',
  grammar: 'Ngữ pháp',
  vocab: 'Từ vựng',
  mock: 'Kiểm tra',
};
const LEVEL = ['bg-muted', 'bg-heat-1', 'bg-heat-2', 'bg-heat-3', 'bg-heat-4'];

/** Share of each week's tasks done, split by skill: shows which kind of work a learner skips. */
function WeekSkillGrid({ program, track, done }: { program: Program; track: Track; done: Set<string> }) {
  const weeks = roadmaps[program];
  const cells = weeks.map((w) => {
    const tasks = w.days.flatMap((d) => tasksFor(w, d.day, track));
    const bySkill = new Map<Task['skill'], { done: number; total: number }>();
    for (const t of tasks) {
      const c = bySkill.get(t.skill) ?? { done: 0, total: 0 };
      c.total += 1;
      if (done.has(t.id)) c.done += 1;
      bySkill.set(t.skill, c);
    }
    return bySkill;
  });
  const skills = (Object.keys(SKILL_LABEL) as Task['skill'][]).filter((s) => cells.some((c) => c.has(s)));

  return (
    <Card>
      <div className="mb-3 flex items-center gap-2">
        <h3 className="font-semibold text-ink">Nhiệm vụ lộ trình theo tuần và kỹ năng</h3>
        <InfoHint label="lưới tuần × kỹ năng">
          Mỗi ô là phần nhiệm vụ đã tích của một kỹ năng trong một tuần (theo nhánh {track}). Ô nhạt hoặc
          trống ở cùng một hàng cho thấy học viên hay bỏ qua kỹ năng đó.
        </InfoHint>
      </div>
      <div className="overflow-x-auto">
        <table className="text-xs">
          <thead>
            <tr>
              <th />
              {weeks.map((w) => (
                <th key={w.week} className="px-0.5 pb-1 font-normal text-ink-muted">
                  T{w.week}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {skills.map((s) => (
              <tr key={s}>
                <th className="pr-2 text-left font-normal whitespace-nowrap text-ink-soft">
                  {SKILL_LABEL[s]}
                </th>
                {cells.map((c, i) => {
                  const v = c.get(s);
                  if (!v) return <td key={i} className="p-0.5" />;
                  const ratio = v.done / v.total;
                  const level = v.done === 0 ? 0 : Math.min(4, Math.ceil(ratio * 4));
                  return (
                    <td key={i} className="p-0.5">
                      <span
                        className={`block h-5 w-6 rounded ${LEVEL[level]}`}
                        title={`Tuần ${i + 1} · ${SKILL_LABEL[s]}: ${v.done}/${v.total} nhiệm vụ`}
                        aria-label={`Tuần ${i + 1}, ${SKILL_LABEL[s]}: ${v.done} trên ${v.total}`}
                        role="img"
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

interface AnswerRow {
  id: number;
  created_at: string;
  mode: 'practice' | 'review' | 'exam' | 'mock';
  response: unknown;
  is_correct: boolean | null;
  time_ms: number | null;
  ot_questions: { id: number; ext_id: string | null; stem_html: string; tags: string[] | null } | null;
}

const MODE: Record<AnswerRow['mode'], string> = {
  practice: 'Luyện tập',
  review: 'Ôn lại',
  exam: 'Bài thi',
  mock: 'Thi thử',
};

function plain(html: string, max = 90): string {
  const text = html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function responseText(r: unknown): string {
  if (r === null || r === undefined) return '(bỏ trống)';
  if (typeof r === 'string') return r;
  if (typeof r === 'object')
    return Object.entries(r as Record<string, boolean>)
      .map(([k, v]) => `${k}:${v ? 'Đ' : 'S'}`)
      .join(' ');
  return String(r);
}

function RecentAnswers({ userId, course }: { userId: string; course: CourseId }) {
  const load = useCallback(
    async () =>
      unwrap(
        await db()
          .from('ot_responses')
          .select(
            'id, created_at, mode, response, is_correct, time_ms, ot_questions(id, ext_id, stem_html, tags)',
          )
          .eq('user_id', userId)
          .eq('course_id', course)
          .order('created_at', { ascending: false })
          .limit(40),
      ) as unknown as AnswerRow[],
    [userId, course],
  );
  const { data, loading, error } = useAsync(load);

  return (
    <Card>
      <h3 className="mb-3 font-semibold text-ink">40 lần trả lời gần nhất</h3>
      {loading ? (
        <Spinner />
      ) : error ? (
        <ErrorBox message={error} />
      ) : (data ?? []).length === 0 ? (
        <p className="text-sm text-ink-muted">Chưa có câu trả lời nào được ghi lại.</p>
      ) : (
        <ol className="divide-y divide-line text-sm">
          {(data ?? []).map((a) => {
            const at = new Date(a.created_at);
            return (
              <li key={a.id} className="flex flex-wrap items-start gap-3 py-2">
                <span
                  className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full ${
                    a.is_correct === null
                      ? 'bg-muted text-ink-muted'
                      : a.is_correct
                        ? 'bg-ok-soft text-ok-ink'
                        : 'bg-bad-soft text-bad-ink'
                  }`}
                  aria-label={a.is_correct === null ? 'Không chấm' : a.is_correct ? 'Đúng' : 'Sai'}
                >
                  {a.is_correct ? (
                    <IconCheck size={13} strokeWidth={3} />
                  ) : a.is_correct === false ? (
                    <IconX size={13} strokeWidth={3} />
                  ) : (
                    '–'
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-ink">
                    <span className="font-medium">
                      {a.ot_questions?.ext_id ?? `#${a.ot_questions?.id ?? ''}`}
                    </span>{' '}
                    <span className="text-ink-soft">{plain(a.ot_questions?.stem_html ?? '')}</span>
                  </p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-ink-muted">
                    <Badge>{MODE[a.mode]}</Badge>
                    <span>Trả lời: {responseText(a.response)}</span>
                    {a.time_ms !== null && <span>· {formatDuration(a.time_ms)}</span>}
                    {(a.ot_questions?.tags ?? []).slice(0, 2).map((t) => (
                      <span key={t}>· {tagLabel(course, t)}</span>
                    ))}
                  </div>
                </div>
                <time className="text-xs whitespace-nowrap text-ink-muted" dateTime={a.created_at}>
                  {at.toLocaleString('vi-VN', {
                    timeZone: 'Asia/Ho_Chi_Minh',
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </time>
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}
