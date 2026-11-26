import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Mascot } from '../../components/art/Mascot.tsx';
import { Confetti } from '../../components/effects.tsx';
import { IconArrowLeft, IconClock } from '../../components/icons.tsx';
import { buttonClass } from '../../components/styles.ts';
import { Badge, Button, Card, EmptyState, ErrorBox, ProgressBar, Spinner } from '../../components/ui.tsx';
import { tagLabel } from '../../content/bank.ts';
import { roadmaps } from '../../content/index.ts';
import type { PracticeLink, Program, Task } from '../../content/schema.ts';
import { useAuth } from '../../lib/auth-context.ts';
import { findTask, taskWeek } from '../../lib/roadmap.ts';
import { percent } from '../../lib/streak.ts';
import { db, errorMessage } from '../../lib/supabase.ts';
import { unwrap, useAsync } from '../../lib/useAsync.ts';
import { useBank } from './context.ts';
import { idsFrom, loadMockTests, loadQuestions, type OtQuestion, type Reveal } from './data.ts';
import { PracticeCard } from './PracticePage.tsx';

const DAY_NAMES = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
const BATCH = 20;

type LinkOf<K extends PracticeLink['kind']> = Extract<PracticeLink, { kind: K }>;

/** `nv/:taskId`: the practice behind a roadmap task's "Làm ngay" button. */
export function TaskPracticePage() {
  const { taskId = '' } = useParams();
  const { course } = useBank();
  const program: Program | null = course === 'on-tap-11' ? null : course;
  const found = program ? findTask(roadmaps[program], taskId) : undefined;
  const link = found?.task.practice;

  if (!program || !found || !link) {
    return (
      <EmptyState title="Không tìm thấy nhiệm vụ này" mood="thinking">
        Nhiệm vụ có thể đã đổi tên hoặc không có phần luyện tập trên web.
      </EmptyState>
    );
  }
  const home = `/c/${program}/hom-nay`;

  return (
    <div className="space-y-4">
      <div>
        <Link to={home} className="inline-flex items-center gap-1 text-sm text-brand-ink hover:underline">
          <IconArrowLeft size={15} /> Hôm nay
        </Link>
        <p className="mt-2 text-xs font-medium tracking-wide text-ink-muted uppercase">
          Tuần {found.week} · {DAY_NAMES[found.day - 1]}
        </p>
        <h1 className="text-lg font-semibold text-ink">{found.task.title}</h1>
      </div>
      {link.kind === 'practice' ? (
        <TaskDrill key={taskId} task={found.task} link={link} program={program} home={home} />
      ) : link.kind === 'exam' ? (
        <TaskExam task={found.task} link={link} />
      ) : (
        <TaskMock task={found.task} program={program} />
      )}
    </div>
  );
}

/** Answer `count` questions of the task's tags; the server ticks the task when the count is reached. */
function TaskDrill({
  task,
  link,
  program,
  home,
}: {
  task: Task;
  link: LinkOf<'practice'>;
  program: Program;
  home: string;
}) {
  const { session } = useAuth();
  const userId = session?.user.id;
  const [queue, setQueue] = useState<OtQuestion[]>([]);
  const [pos, setPos] = useState(0);
  const [shown, setShown] = useState(1);
  const [answered, setAnswered] = useState(0);
  const [done, setDone] = useState(false);
  const [celebrate, setCelebrate] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // State updates happen only after the requests resolve, so these are safe to call from an effect.
  const fetchBatch = useCallback(
    () =>
      Promise.resolve(db().rpc('ot_task_question_ids', { p_task: task.id, p_limit: BATCH }))
        .then((res) => loadQuestions(idsFrom(unwrap(res), 'ot_task_question_ids')))
        .then(
          (questions) => {
            setQueue(questions);
            setPos(0);
          },
          (e: unknown) => setError(errorMessage(e)),
        )
        .finally(() => setLoading(false)),
    [task.id],
  );

  useEffect(() => {
    void fetchBatch();
    if (!userId) return;
    void Promise.all([
      db().rpc('ot_task_answer_counts', { p_course: program }),
      db().from('task_progress').select('task_id').eq('task_id', task.id).eq('user_id', userId),
    ]).then(([counts, ticked]) => {
      const rows = (counts.data ?? []) as { task_id: string; answered: number }[];
      setAnswered(rows.find((r) => r.task_id === task.id)?.answered ?? 0);
      setDone((ticked.data ?? []).length > 0);
    });
  }, [fetchBatch, program, task.id, userId]);

  const onResult = (r: Reveal) => {
    if (!r.task) return;
    setAnswered(r.task.answered);
    if (r.task.done && !done) setCelebrate((n) => n + 1);
    setDone(r.task.done);
  };

  const next = () => {
    setShown((n) => n + 1);
    if (pos + 1 < queue.length) {
      setPos(pos + 1);
      return;
    }
    setLoading(true);
    void fetchBatch();
  };

  const q = queue[pos];
  const shownCount = Math.min(answered, link.count);

  return (
    <>
      <Card variant="soft" className="relative space-y-2">
        <Confetti fire={celebrate} pieces={30} />
        {done ? (
          <div className="flex items-center gap-3">
            <Mascot mood="cheer" size={56} decorative />
            <div className="mr-auto">
              <p className="font-semibold text-ok-ink">Xong nhiệm vụ rồi!</p>
              <p className="text-sm text-ink-soft">
                Nhiệm vụ đã được tích trên trang Hôm nay. Muốn luyện thêm thì cứ làm tiếp bên dưới.
              </p>
            </div>
            <Link to={home} className={buttonClass('primary', 'sm')}>
              Về Hôm nay
            </Link>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
              <span className="text-ink">
                Đã làm <b className="tabular-nums">{shownCount}</b>/{link.count} câu
              </span>
              <span className="text-xs text-ink-muted">Đủ {link.count} câu thì nhiệm vụ tự được tích</span>
            </div>
            <ProgressBar value={percent(shownCount, link.count)} label="Tiến độ nhiệm vụ" />
          </>
        )}
        <div className="flex flex-wrap gap-1">
          {link.tags.map((t) => (
            <Badge key={t}>{tagLabel(program, t)}</Badge>
          ))}
        </div>
      </Card>
      {error && <ErrorBox message={error} />}
      {loading ? (
        <Spinner />
      ) : !q ? (
        <EmptyState title="Phần này chưa có câu hỏi">
          Bé Cú đang soạn thêm. Bạn quay lại trang Hôm nay và tự tích nhiệm vụ khi đã làm bằng sách nhé.
        </EmptyState>
      ) : (
        <PracticeCard
          key={`${q.id}:${shown}`}
          q={q}
          index={shown}
          onNext={next}
          task={task.id}
          onResult={onResult}
        />
      )}
    </>
  );
}

interface TaskAttempt {
  id: number;
  deadline_at: string | null;
  submitted_at: string | null;
}

/** A timed mini test made of the task's parts; the server ticks the task on submit. */
function TaskExam({ task, link }: { task: Task; link: LinkOf<'exam'> }) {
  const navigate = useNavigate();
  const { base } = useBank();
  const { session } = useAuth();
  const userId = session?.user.id ?? '';
  const [busy, setBusy] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const load = useCallback(async () => {
    const rows = unwrap(
      await db()
        .from('ot_attempts')
        .select('id, deadline_at, submitted_at')
        .eq('task_id', task.id)
        .eq('user_id', userId)
        .order('started_at', { ascending: false })
        .limit(1),
    ) as TaskAttempt[];
    const last = rows[0] ?? null;
    // Still running: not submitted and before its deadline, so "Làm tiếp" resumes it.
    const open =
      last !== null &&
      !last.submitted_at &&
      (!last.deadline_at || new Date(last.deadline_at).getTime() > Date.now());
    return { last, open };
  }, [task.id, userId]);
  const { data, loading, error } = useAsync(load);
  const last = data?.last ?? null;

  const start = async () => {
    setBusy(true);
    setStartError(null);
    const { data: id, error: err } = await db().rpc('ot_start_task_exam', { p_task: task.id });
    setBusy(false);
    if (err)
      setStartError(
        /no questions/.test(err.message) ? 'Ngân hàng chưa đủ câu cho bài này.' : errorMessage(err),
      );
    else navigate(`${base}/thi-thu/${id}`);
  };

  if (loading) return <Spinner />;
  if (error) return <ErrorBox message={error} />;

  return (
    <Card className="space-y-4">
      <div className="flex items-center gap-3">
        <Mascot mood="thinking" size={56} decorative />
        <div>
          <p className="font-semibold text-ink">Mini test có bấm giờ</p>
          <p className="flex items-center gap-1 text-sm text-ink-soft">
            <IconClock size={14} /> {link.minutes} phút · hết giờ bài tự nộp
          </p>
        </div>
      </div>
      <ul className="grid gap-2 sm:grid-cols-2">
        {link.parts.map((p) => (
          <li key={p.label} className="rounded-2xl bg-subtle p-3 text-sm">
            <span className="font-medium text-ink">{p.label}</span>
            <span className="text-ink-soft"> · {p.count} câu</span>
          </li>
        ))}
      </ul>
      <p className="text-sm text-ink-soft">
        Câu hỏi lấy ngẫu nhiên từ ngân hàng, giữ nguyên từng đoạn hội thoại và bài đọc. Nộp bài xong, nhiệm vụ
        tự được tích và các câu sai vào mục Ôn lại.
      </p>
      {startError && <ErrorBox message={startError} />}
      <div className="flex flex-wrap gap-2">
        {data?.open && last ? (
          <Button onClick={() => navigate(`${base}/thi-thu/${last.id}`)}>Làm tiếp bài đang dở</Button>
        ) : (
          <Button onClick={() => void start()} disabled={busy}>
            {last ? 'Làm bài mới' : 'Bắt đầu'}
          </Button>
        )}
        {last?.submitted_at && (
          <Link to={`${base}/ket-qua/${last.id}`} className={buttonClass('ghost')}>
            Xem kết quả lần trước
          </Link>
        )}
      </div>
    </Card>
  );
}

/** The site's mock test for the task's week; submitting it ticks the task. */
function TaskMock({ task, program }: { task: Task; program: Program }) {
  const navigate = useNavigate();
  const { base } = useBank();
  const week = taskWeek(task.id);
  const load = useCallback(
    async () => (await loadMockTests(program)).find((m) => m.week === week) ?? null,
    [program, week],
  );
  const { data: mock, loading, error } = useAsync(load);
  const [busy, setBusy] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const scores = `/c/${program}/diem-thi-thu`;

  if (loading) return <Spinner />;
  if (error) return <ErrorBox message={error} />;
  if (!mock) {
    return (
      <EmptyState
        title="Đề thi thử tuần này chưa có trên web"
        mood="sleepy"
        action={
          <Link to={scores} className={buttonClass('primary')}>
            Nhập điểm thi thử
          </Link>
        }
      >
        Cả nhóm làm đề trong sách cùng giờ, rồi nhập điểm ở trang Điểm thi thử và tự tích nhiệm vụ.
      </EmptyState>
    );
  }

  const start = async () => {
    setBusy(true);
    setStartError(null);
    const { data: id, error: err } = await db().rpc('ot_start_mock', { p_test: mock.id });
    setBusy(false);
    if (err) setStartError(errorMessage(err));
    else navigate(`${base}/thi-thu/${id}`);
  };

  return (
    <Card className="space-y-4">
      <div className="flex items-center gap-3">
        <Mascot mood="cheer" size={56} decorative />
        <div>
          <p className="font-semibold text-ink">{mock.title}</p>
          <p className="flex items-center gap-1 text-sm text-ink-soft">
            <IconClock size={14} /> {mock.minutes} phút · {mock.sections.map((s) => s.label).join(' + ')}
          </p>
        </div>
      </div>
      <p className="text-sm text-ink-soft">
        Nộp bài xong, điểm quy đổi được lưu vào trang Điểm thi thử và nhiệm vụ tự được tích. Đề trên web là
        bản rút gọn để ước lượng điểm; nếu cả nhóm làm full test trong sách, hãy{' '}
        <Link to={scores} className="font-medium text-brand-ink hover:underline">
          nhập điểm
        </Link>{' '}
        và tự tích nhiệm vụ.
      </p>
      {startError && <ErrorBox message={startError} />}
      <Button onClick={() => void start()} disabled={busy}>
        Bắt đầu thi thử
      </Button>
    </Card>
  );
}
