import { useCallback, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Badge,
  Button,
  Card,
  ErrorBox,
  inputClass,
  PageHeader,
  ProgressBar,
  Spinner,
} from '../../components/ui.tsx';
import { roadmaps, scoring, vocab } from '../../content/index.ts';
import type { Program, Track } from '../../content/schema.ts';
import { useAuth } from '../../lib/auth-context.ts';
import { formatDateVN, todayVN, toDateVN } from '../../lib/dates.ts';
import { allTasks, positionOn, weekCompletion } from '../../lib/roadmap.ts';
import { toTen } from '../../lib/scores.ts';
import { currentStreak, percent } from '../../lib/streak.ts';
import { db, errorMessage } from '../../lib/supabase.ts';
import {
  STATUS_LABEL,
  type AdminUserRow,
  type CourseId,
  type EnrollmentStatus,
  type FlashcardReview,
  type MockScore,
  type PlacementResult,
} from '../../lib/types.ts';
import { unwrap, useAsync } from '../../lib/useAsync.ts';

interface Detail {
  user: AdminUserRow;
  tasks: { course_id: string; task_id: string; completed_at: string }[];
  placements: PlacementResult[];
  mocks: MockScore[];
  cards: FlashcardReview[];
  ot: {
    seen: number;
    correct: number;
    lastSeen: string | null;
    bySubject: { name: string; seen: number; correct: number }[];
    attempts: { id: number; submitted_at: string; score: number; max_score: number }[];
  };
}

async function loadDetail(userId: string): Promise<Detail> {
  const users = unwrap(await db().rpc('admin_list_users')) as AdminUserRow[];
  const user = users.find((u) => u.id === userId);
  if (!user) throw new Error('Không tìm thấy người dùng');

  const [tasks, placements, mocks, cards, stats, attempts] = await Promise.all([
    db().from('task_progress').select('course_id, task_id, completed_at').eq('user_id', userId),
    db().from('placement_results').select('*').eq('user_id', userId).order('taken_at', { ascending: false }),
    db().from('mock_scores').select('*').eq('user_id', userId).order('taken_at'),
    db().from('flashcard_reviews').select('*').eq('user_id', userId),
    db().from('ot_question_stats').select('question_id, seen, correct, last_seen_at').eq('user_id', userId),
    db()
      .from('ot_attempts')
      .select('id, submitted_at, score, max_score')
      .eq('user_id', userId)
      .not('submitted_at', 'is', null)
      .order('submitted_at', { ascending: false })
      .limit(20),
  ]);

  const statRows = unwrap(stats) as {
    question_id: number;
    seen: number;
    correct: number;
    last_seen_at: string | null;
  }[];
  const bySubject = new Map<string, { name: string; seen: number; correct: number }>();
  if (statRows.length > 0) {
    // Map each answered question to its subject: question -> topic -> chapter -> subject.
    const ids = statRows.map((s) => s.question_id);
    const [qs, topics, chapters, subjects] = await Promise.all([
      db().from('ot_questions').select('id, topic_id').in('id', ids),
      db().from('ot_topics').select('id, chapter_id'),
      db().from('ot_chapters').select('id, subject_id'),
      db().from('ot_subjects').select('id, name'),
    ]);
    const topicOf = new Map(
      (unwrap(qs) as { id: number; topic_id: number }[]).map((q) => [q.id, q.topic_id]),
    );
    const chapterOf = new Map(
      (unwrap(topics) as { id: number; chapter_id: number }[]).map((t) => [t.id, t.chapter_id]),
    );
    const subjectOf = new Map(
      (unwrap(chapters) as { id: number; subject_id: number }[]).map((c) => [c.id, c.subject_id]),
    );
    const subjectName = new Map(
      (unwrap(subjects) as { id: number; name: string }[]).map((s) => [s.id, s.name]),
    );
    for (const s of statRows) {
      const name =
        subjectName.get(subjectOf.get(chapterOf.get(topicOf.get(s.question_id) ?? -1) ?? -1) ?? -1) ?? 'Khác';
      const agg = bySubject.get(name) ?? { name, seen: 0, correct: 0 };
      agg.seen += 1;
      if (s.correct > 0) agg.correct += 1;
      bySubject.set(name, agg);
    }
  }

  return {
    user,
    tasks: unwrap(tasks) as Detail['tasks'],
    placements: unwrap(placements) as PlacementResult[],
    mocks: unwrap(mocks) as MockScore[],
    cards: unwrap(cards) as FlashcardReview[],
    ot: {
      seen: statRows.length,
      correct: statRows.filter((s) => s.correct > 0).length,
      lastSeen:
        statRows
          .map((s) => s.last_seen_at)
          .filter(Boolean)
          .sort()
          .pop() ?? null,
      bySubject: [...bySubject.values()],
      attempts: unwrap(attempts) as Detail['ot']['attempts'],
    },
  };
}

export function AdminUserPage() {
  const userId = useParams().userId ?? '';
  const { courses, session } = useAuth();
  const load = useCallback(() => loadDetail(userId), [userId]);
  const { data, loading, error, reload } = useAsync(load);
  const [actionError, setActionError] = useState<string | null>(null);

  if (loading) return <Spinner />;
  if (error) return <ErrorBox message={error} />;
  if (!data) return null;
  const { user } = data;

  const setRole = async (role: 'learner' | 'admin') => {
    const { error: err } = await db().rpc('admin_set_role', { p_user: userId, p_role: role });
    if (err) setActionError(errorMessage(err));
    reload();
  };

  return (
    <div className="space-y-5">
      <Link to="/admin" className="text-sm text-indigo-700 hover:underline">
        ← Danh sách người dùng
      </Link>
      <PageHeader
        title={user.display_name || user.email}
        subtitle={
          <>
            {user.email} · tạo ngày {formatDateVN(toDateVN(user.created_at))}
            {user.last_sign_in_at && ` · đăng nhập gần nhất ${formatDateVN(toDateVN(user.last_sign_in_at))}`}
          </>
        }
        actions={
          user.id !== session?.user.id &&
          (user.role === 'admin' ? (
            <Button variant="secondary" onClick={() => void setRole('learner')}>
              Bỏ quyền admin
            </Button>
          ) : (
            <Button variant="secondary" onClick={() => void setRole('admin')}>
              Cấp quyền admin
            </Button>
          ))
        }
      />
      {actionError && <ErrorBox message={actionError} />}

      {courses.map((c) => (
        <CourseCard
          key={c.id}
          course={c.id}
          title={c.title}
          detail={data}
          onSaved={reload}
          onError={setActionError}
        />
      ))}
    </div>
  );
}

function CourseCard({
  course,
  title,
  detail,
  onSaved,
  onError,
}: {
  course: CourseId;
  title: string;
  detail: Detail;
  onSaved(): void;
  onError(msg: string): void;
}) {
  const e = detail.user.enrollments.find((x) => x.course_id === course);
  const [status, setStatus] = useState<EnrollmentStatus>(e?.status ?? 'approved');
  const [track, setTrack] = useState<Track | ''>(e?.track ?? '');
  const [start, setStart] = useState(e?.start_date ?? '');
  const isRoadmap = course === 'toeic' || course === 'ielts';

  const save = async () => {
    const { error: err } = await db().rpc('admin_set_enrollment', {
      p_user: detail.user.id,
      p_course: course,
      p_status: status,
      p_track: isRoadmap && track ? track : null,
      p_start_date: isRoadmap && start ? start : null,
    });
    if (err) onError(errorMessage(err));
    onSaved();
  };

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="flex-1 font-semibold">{title}</h2>
        {e ? (
          <Badge color={e.status === 'approved' ? 'green' : e.status === 'pending' ? 'yellow' : 'gray'}>
            {STATUS_LABEL[e.status]}
          </Badge>
        ) : (
          <Badge>Chưa đăng ký</Badge>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-end gap-2 text-sm">
        <label>
          <span className="mb-1 block text-xs text-slate-500">Trạng thái</span>
          <select
            className={inputClass}
            value={status}
            onChange={(ev) => setStatus(ev.target.value as EnrollmentStatus)}
          >
            {(['approved', 'pending', 'rejected', 'revoked'] as const).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        {isRoadmap && (
          <>
            <label>
              <span className="mb-1 block text-xs text-slate-500">Nhánh</span>
              <select
                className={inputClass}
                value={track}
                onChange={(ev) => setTrack(ev.target.value as Track | '')}
              >
                <option value="">Chưa xếp</option>
                <option value="A">A</option>
                <option value="B">B</option>
                <option value="C">C</option>
              </select>
            </label>
            <label>
              <span className="mb-1 block text-xs text-slate-500">Ngày bắt đầu</span>
              <input
                type="date"
                className={inputClass}
                value={start}
                onChange={(ev) => setStart(ev.target.value)}
              />
            </label>
          </>
        )}
        <Button onClick={() => void save()}>{e ? 'Lưu' : 'Gán khóa học'}</Button>
      </div>

      {isRoadmap && e && (
        <RoadmapProgress program={course} detail={detail} track={e.track} startDate={e.start_date} />
      )}
      {course === 'on-tap-11' && e && <OtProgress detail={detail} />}
    </Card>
  );
}

function RoadmapProgress({
  program,
  detail,
  track,
  startDate,
}: {
  program: Program;
  detail: Detail;
  track: Track | null;
  startDate: string | null;
}) {
  const today = todayVN();
  const tasks = detail.tasks.filter((t) => t.course_id === program);
  const done = new Set(tasks.map((t) => t.task_id));
  const days = tasks.map((t) => toDateVN(t.completed_at));
  const last = [...days].sort().pop();
  const placement = detail.placements.find((p) => p.course_id === program);
  const mocks = detail.mocks.filter((m) => m.course_id === program);
  const cards = detail.cards.filter((c) => c.course_id === program);
  const due = cards.filter((c) => c.due_date <= today).length;

  if (!track) {
    return <p className="mt-4 text-sm text-slate-500">Chưa xếp nhánh, chưa có tiến độ lộ trình.</p>;
  }

  const total = allTasks(roadmaps[program], track).length;
  const pos = startDate ? positionOn(startDate, today) : null;
  const threshold = scoring[program].thresholds.find((t) => t.track === track);

  return (
    <div className="mt-4 space-y-4 text-sm">
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat
          label="Hoàn thành"
          value={`${percent(done.size, total)}%`}
          sub={`${done.size}/${total} nhiệm vụ`}
        />
        <Stat
          label="Streak"
          value={`${currentStreak(days, today)} ngày`}
          sub={`${new Set(days).size} ngày có học`}
        />
        <Stat
          label="Đang ở"
          value={
            pos
              ? pos.status === 'not_started'
                ? 'Chưa bắt đầu'
                : pos.status === 'finished'
                  ? 'Đã xong'
                  : `Tuần ${pos.week}`
              : '—'
          }
          sub={last ? `học gần nhất ${formatDateVN(last)}` : 'chưa học ngày nào'}
        />
        <Stat
          label="Flashcard"
          value={`${cards.filter((c) => c.reps > 0).length}/${vocab[program].length}`}
          sub={`${due} thẻ đến hạn`}
        />
      </div>

      <div>
        <p className="mb-1 font-medium">
          Tiến độ theo tuần (nhánh {track}
          {threshold ? `, mục tiêu ${threshold.target}` : ''})
        </p>
        <div className="grid grid-cols-6 gap-2 sm:grid-cols-12">
          {roadmaps[program].map((w) => {
            const c = weekCompletion(w, track, done);
            return (
              <div key={w.week} title={`Tuần ${w.week}: ${c.done}/${c.total}`}>
                <ProgressBar value={percent(c.done, c.total)} />
                <p className="mt-0.5 text-center text-[11px] text-slate-500">T{w.week}</p>
              </div>
            );
          })}
        </div>
      </div>

      <p>
        <span className="font-medium">Bài test đầu vào: </span>
        {placement
          ? placement.source === 'test'
            ? `đúng ${placement.correct_count}/${placement.total} câu, xếp nhánh ${placement.track} (${formatDateVN(toDateVN(placement.taken_at))})`
            : `điểm thi thật ${placement.real_score}, xếp nhánh ${placement.track}`
          : 'chưa làm'}
      </p>

      <div>
        <p className="font-medium">Điểm thi thử</p>
        {mocks.length === 0 ? (
          <p className="text-slate-500">Chưa nhập lần nào.</p>
        ) : (
          <ul className="mt-1 space-y-0.5">
            {mocks.map((m) => (
              <li key={m.id}>
                {formatDateVN(m.taken_at)}
                {m.week ? ` (tuần ${m.week})` : ''}: <b>{m.total}</b>{' '}
                <span className="text-slate-500">
                  L {m.listening ?? '—'} · R {m.reading ?? '—'}
                  {program === 'ielts' && ` · W ${m.writing ?? '—'} · S ${m.speaking ?? '—'}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function OtProgress({ detail }: { detail: Detail }) {
  const { ot } = detail;
  return (
    <div className="mt-4 space-y-3 text-sm">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Câu đã làm" value={String(ot.seen)} sub={`${ot.correct} câu đã làm đúng`} />
        <Stat label="Tỉ lệ đúng" value={`${percent(ot.correct, ot.seen)}%`} />
        <Stat label="Học gần nhất" value={ot.lastSeen ? formatDateVN(toDateVN(ot.lastSeen)) : '—'} />
      </div>
      {ot.bySubject.length > 0 && (
        <ul className="space-y-0.5">
          {ot.bySubject.map((s) => (
            <li key={s.name}>
              {s.name}: {s.seen} câu, đúng {s.correct} ({percent(s.correct, s.seen)}%)
            </li>
          ))}
        </ul>
      )}
      <div>
        <p className="font-medium">Bài thi thử</p>
        {ot.attempts.length === 0 ? (
          <p className="text-slate-500">Chưa thi lần nào.</p>
        ) : (
          <ul className="mt-1 space-y-0.5">
            {ot.attempts.map((a) => (
              <li key={a.id}>
                <Link to={`/c/on-tap-11/ket-qua/${a.id}`} className="text-indigo-700 hover:underline">
                  {formatDateVN(toDateVN(a.submitted_at))}
                </Link>
                : {toTen(a.score, a.max_score)}/10
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
      {sub && <p className="text-xs text-slate-500">{sub}</p>}
    </div>
  );
}
