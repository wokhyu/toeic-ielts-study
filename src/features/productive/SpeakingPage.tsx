import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Mascot } from '../../components/art/Mascot.tsx';
import { IconArrowLeft, IconMic, IconStop, IconVolume } from '../../components/icons.tsx';
import { Badge, Button, Card, EmptyState, ErrorBox, Notice } from '../../components/ui.tsx';
import type { SpeakingSet } from '../../content/schema.ts';
import { useAuth } from '../../lib/auth-context.ts';
import { clock } from '../../lib/ielts.ts';
import { speak, speechSupported } from '../../lib/speech.ts';
import { db, errorMessage } from '../../lib/supabase.ts';
import { useRoadmap } from '../../pages/roadmap/context.ts';
import { IELTS_BASE, speakingSet, type AudioPart } from './data.ts';
import { fileTypeOf, Recording, recordingSupported, type Take } from './recorder.ts';

interface Question {
  part: 1 | 2 | 3;
  text: string;
  /** Longest answer; recording stops by itself. */
  maxSeconds: number;
}

function questionsOf(set: SpeakingSet): Question[] {
  return [
    ...set.part1.map((text) => ({ part: 1 as const, text, maxSeconds: 60 })),
    { part: 2 as const, text: set.part2.cue, maxSeconds: set.part2.talk_seconds },
    ...set.part3.map((text) => ({ part: 3 as const, text, maxSeconds: 90 })),
  ];
}

/** `noi/:setId`: answer each question aloud, listen back, then save the recordings. */
export function SpeakingPage() {
  const { setId = '' } = useParams();
  const set = speakingSet(setId);
  if (!set) return <EmptyState title="Không tìm thấy bộ câu hỏi này" />;
  return <Session key={set.id} set={set} />;
}

function Session({ set }: { set: SpeakingSet }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const taskId = params.get('nv');
  const { preview } = useRoadmap();
  const { session } = useAuth();
  const userId = session?.user.id;
  const questions = questionsOf(set);
  const [takes, setTakes] = useState<Record<number, Take>>({});
  const [active, setActive] = useState<number | null>(null);
  const [submissionId, setSubmissionId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Free the recordings' memory when leaving the page.
  const takesRef = useRef(takes);
  useEffect(() => {
    takesRef.current = takes;
  }, [takes]);
  useEffect(() => () => Object.values(takesRef.current).forEach((t) => URL.revokeObjectURL(t.url)), []);

  const recorded = Object.keys(takes).length;

  const save = async () => {
    if (!userId) return;
    setBusy(true);
    setError(null);
    try {
      let id = submissionId;
      if (id === null) {
        const { data, error: err } = await db()
          .from('submissions')
          .insert({ course_id: 'ielts', kind: 'speaking', prompt_id: set.id, task_id: taskId, shared: true })
          .select('id')
          .single();
        if (err) throw err;
        id = (data as { id: number }).id;
        setSubmissionId(id);
      }
      const audio: AudioPart[] = [];
      for (const [index, take] of Object.entries(takes).sort(([a], [b]) => Number(a) - Number(b))) {
        const q = questions[Number(index)];
        const { ext, contentType } = fileTypeOf(take.blob.type);
        const path = `${userId}/${id}/${Number(index) + 1}.${ext}`;
        const { error: upErr } = await db()
          .storage.from('speaking')
          .upload(path, take.blob, { contentType, upsert: true });
        if (upErr) throw upErr;
        audio.push({ part: q.part, question: q.text, path, seconds: take.seconds });
      }
      const { error: updErr } = await db()
        .from('submissions')
        .update({ audio, seconds: audio.reduce((s, a) => s + a.seconds, 0) })
        .eq('id', id);
      if (updErr) throw updErr;
      navigate(`${IELTS_BASE}/bai/${id}`);
    } catch (e) {
      setError(`Chưa lưu được: ${errorMessage(e)}. Bản ghi vẫn còn trên trang, bạn bấm lưu lại nhé.`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <Link
        to={`${IELTS_BASE}/viet-noi?tab=noi`}
        className="inline-flex items-center gap-1 text-sm text-brand-ink hover:underline"
      >
        <IconArrowLeft size={15} /> Viết & Nói
      </Link>
      <Card variant="hero" className="flex items-center gap-3">
        <Mascot mood="happy" size={64} decorative />
        <div>
          <p className="text-sm text-ink-soft">Speaking · tuần {set.week}</p>
          <h1 className="text-lg font-semibold text-ink">{set.topic_vi}</h1>
          <p className="text-sm text-ink-soft">
            Trả lời từng câu như đang thi: Part 1 khoảng 20–30 giây, Part 2 nói đủ 1–2 phút, Part 3 trả lời có
            lý do và ví dụ.
          </p>
        </div>
      </Card>
      {!recordingSupported && (
        <Notice>
          Trình duyệt này không ghi âm được. Hãy mở trang bằng Chrome, Edge hoặc Safari bản mới.
        </Notice>
      )}

      {([1, 2, 3] as const).map((part) => (
        <section key={part} className="space-y-2">
          <h2 className="font-semibold text-ink">Part {part}</h2>
          {part === 2 && <CueCard set={set} />}
          {questions.map((q, i) =>
            q.part === part ? (
              <QuestionCard
                key={i}
                index={i}
                question={q}
                take={takes[i]}
                disabled={!recordingSupported || preview || (active !== null && active !== i)}
                onStart={() => setActive(i)}
                onTake={(take) => {
                  setActive(null);
                  setTakes((prev) => {
                    if (prev[i]) URL.revokeObjectURL(prev[i].url);
                    return { ...prev, [i]: take };
                  });
                }}
                onError={(message) => {
                  setActive(null);
                  setError(message);
                }}
              />
            ) : null,
          )}
        </section>
      ))}

      <Card className="space-y-3">
        <p className="text-sm text-ink-soft">
          Đã ghi {recorded}/{questions.length} câu. Bài được chia sẻ với bạn cùng khóa để nghe và chấm chéo;
          bạn có thể tắt chia sẻ trong trang bài nộp.
        </p>
        {error && <ErrorBox message={error} />}
        <Button onClick={() => void save()} disabled={busy || recorded === 0 || active !== null || !userId}>
          {busy ? 'Đang lưu…' : 'Lưu bài nói'}
        </Button>
      </Card>
    </div>
  );
}

function CueCard({ set }: { set: SpeakingSet }) {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    if (left === null || left <= 0) return;
    const id = window.setTimeout(() => setLeft((s) => (s === null ? null : s - 1)), 1000);
    return () => window.clearTimeout(id);
  }, [left]);
  return (
    <Card variant="soft" className="space-y-2">
      <p className="font-medium text-ink">{set.part2.cue}</p>
      <p className="text-sm text-ink-soft">You should say:</p>
      <ul className="list-disc pl-5 text-sm text-ink">
        {set.part2.bullets.map((b) => (
          <li key={b}>{b}</li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {left === null ? (
          <Button size="sm" variant="secondary" onClick={() => setLeft(set.part2.prep_seconds)}>
            Bắt đầu {set.part2.prep_seconds / 60} phút chuẩn bị
          </Button>
        ) : left > 0 ? (
          <span className="tabular-nums text-ink-soft" aria-live="polite">
            Chuẩn bị: còn {clock(left)}. Ghi vài từ khóa ra giấy.
          </span>
        ) : (
          <span className="font-medium text-ok-ink">Hết giờ chuẩn bị, bấm ghi âm và nói đủ 1–2 phút.</span>
        )}
      </div>
    </Card>
  );
}

function QuestionCard({
  index,
  question,
  take,
  disabled,
  onStart,
  onTake,
  onError,
}: {
  index: number;
  question: Question;
  take: Take | undefined;
  disabled: boolean;
  onStart(): void;
  onTake(take: Take): void;
  onError(message: string): void;
}) {
  const recording = useRef<Recording | null>(null);
  const [elapsed, setElapsed] = useState<number | null>(null);

  const stop = async () => {
    const r = recording.current;
    recording.current = null;
    setElapsed(null);
    if (r) onTake(await r.stop());
  };

  // Count the seconds, and stop at the limit.
  useEffect(() => {
    if (elapsed === null) return;
    const id = window.setTimeout(() => {
      if (elapsed + 1 >= question.maxSeconds) void stop();
      else setElapsed(elapsed + 1);
    }, 1000);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stop() reads the recording ref
  }, [elapsed, question.maxSeconds]);

  useEffect(() => () => recording.current?.cancel(), []);

  const start = async () => {
    onStart();
    const r = new Recording();
    try {
      await r.start();
      recording.current = r;
      setElapsed(0);
    } catch {
      onError('Không mở được micro. Hãy cho phép trang dùng micro trong trình duyệt rồi thử lại.');
    }
  };

  return (
    <Card className="space-y-2">
      <div className="flex items-start gap-2">
        <Badge>{index + 1}</Badge>
        <p className="flex-1 text-ink">{question.part === 2 ? 'Nói về cue card ở trên' : question.text}</p>
        {speechSupported && question.part !== 2 && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => speak(question.text, 'en-GB')}
            aria-label="Nghe câu hỏi"
          >
            <IconVolume size={16} />
          </Button>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {elapsed === null ? (
          <Button
            size="sm"
            variant={take ? 'secondary' : 'primary'}
            onClick={() => void start()}
            disabled={disabled}
          >
            <IconMic size={15} /> {take ? 'Ghi lại' : 'Ghi âm'}
          </Button>
        ) : (
          <Button size="sm" variant="danger" onClick={() => void stop()}>
            <IconStop size={15} /> Dừng · {clock(elapsed)} / {clock(question.maxSeconds)}
          </Button>
        )}
        {take && elapsed === null && (
          <>
            <audio controls src={take.url} className="h-9 max-w-full" />
            <span className="text-xs text-ink-muted">{clock(take.seconds)}</span>
          </>
        )}
      </div>
    </Card>
  );
}
