import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { IconArrowLeft, IconClock } from '../../components/icons.tsx';
import { Badge, Button, Card, EmptyState, ErrorBox } from '../../components/ui.tsx';
import { clock, wordCount } from '../../lib/ielts.ts';
import { db, errorMessage } from '../../lib/supabase.ts';
import { useRoadmap } from '../../pages/roadmap/context.ts';
import { clearDraft, IELTS_BASE, readDraft, saveDraft, writingPrompt } from './data.ts';
import { WritingVisual } from './WritingVisual.tsx';

/** `viet/:promptId`: write an answer with a timer and word count; the draft stays in this browser. */
export function WritingEditorPage() {
  const { promptId = '' } = useParams();
  const prompt = writingPrompt(promptId);
  if (!prompt) {
    return <EmptyState title="Không tìm thấy đề này">Đề có thể đã được đổi tên.</EmptyState>;
  }
  return <Editor key={prompt.id} promptId={prompt.id} />;
}

function Editor({ promptId }: { promptId: string }) {
  const prompt = writingPrompt(promptId)!;
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const taskId = params.get('nv');
  const { preview } = useRoadmap();
  const [text, setText] = useState(() => readDraft(promptId)?.text ?? '');
  const [seconds, setSeconds] = useState(() => readDraft(promptId)?.seconds ?? 0);
  const [running, setRunning] = useState(false);
  const [shared, setShared] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The clock runs while the learner is writing in this tab.
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') setSeconds((s) => s + 1);
    }, 1000);
    return () => window.clearInterval(id);
  }, [running]);

  useEffect(() => {
    saveDraft(promptId, text, seconds);
  }, [promptId, seconds, text]);

  const words = wordCount(text);
  const limit = prompt.minutes * 60;
  const over = seconds > limit;

  const submit = async () => {
    setBusy(true);
    setError(null);
    const { data, error: err } = await db()
      .from('submissions')
      .insert({
        course_id: 'ielts',
        kind: 'writing',
        prompt_id: prompt.id,
        task_id: taskId,
        text,
        seconds,
        shared,
      })
      .select('id')
      .single();
    setBusy(false);
    if (err) {
      setError(errorMessage(err));
      return;
    }
    clearDraft(prompt.id);
    navigate(`${IELTS_BASE}/bai/${(data as { id: number }).id}`);
  };

  return (
    <div className="space-y-4">
      <Link
        to={`${IELTS_BASE}/viet-noi?tab=viet`}
        className="inline-flex items-center gap-1 text-sm text-brand-ink hover:underline"
      >
        <IconArrowLeft size={15} /> Viết & Nói
      </Link>
      <Card className="space-y-3">
        <div className="flex flex-wrap gap-1">
          <Badge color={prompt.task === 1 ? 'lilac' : 'coral'}>Writing Task {prompt.task}</Badge>
          <Badge>Tuần {prompt.week}</Badge>
          <Badge>
            {prompt.minutes} phút · ≥ {prompt.min_words} từ
          </Badge>
        </div>
        <p className="whitespace-pre-line text-ink">{prompt.prompt}</p>
        {prompt.visuals?.map((v, i) => (
          <WritingVisual key={i} visual={v} />
        ))}
      </Card>

      <Card className="space-y-3">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span
            className={`inline-flex items-center gap-1 tabular-nums ${over ? 'text-warn-ink' : 'text-ink-soft'}`}
          >
            <IconClock size={15} /> {clock(seconds)} / {clock(limit)}
            {over && ' · đã quá giờ thi'}
          </span>
          <span
            className={`tabular-nums ${words >= prompt.min_words ? 'text-ok-ink' : 'text-ink-soft'}`}
            aria-live="polite"
          >
            {words} / {prompt.min_words} từ
          </span>
          <span className="ml-auto text-xs text-ink-muted">Nháp tự lưu trên máy này</span>
        </div>
        <label className="sr-only" htmlFor="answer">
          Bài viết
        </label>
        <textarea
          id="answer"
          className="min-h-80 w-full rounded-2xl border border-line-strong bg-surface p-4 leading-relaxed text-ink focus:ring-2 focus:ring-brand focus:outline-none"
          value={text}
          spellCheck={false}
          onChange={(e) => {
            setText(e.target.value);
            if (!running) setRunning(true);
          }}
          placeholder="Bắt đầu gõ là đồng hồ chạy. Tắt kiểm tra chính tả để luyện như thi thật."
        />
        <label className="flex items-start gap-2 text-sm text-ink">
          <input
            type="checkbox"
            className="mt-1"
            checked={shared}
            onChange={(e) => setShared(e.target.checked)}
          />
          <span>
            Chia sẻ với bạn cùng khóa để được chấm chéo
            <span className="block text-xs text-ink-muted">Có thể tắt sau trong trang bài nộp.</span>
          </span>
        </label>
        {words > 0 && words < prompt.min_words && (
          <p className="text-sm text-warn-ink">
            Bài còn thiếu {prompt.min_words - words} từ so với yêu cầu; khi thi, bài ngắn bị trừ điểm Task{' '}
            {prompt.task === 1 ? 'Achievement' : 'Response'}.
          </p>
        )}
        {error && <ErrorBox message={error} />}
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void submit()} disabled={busy || preview || words === 0}>
            Nộp bài
          </Button>
          {running && (
            <Button variant="ghost" onClick={() => setRunning(false)}>
              Dừng đồng hồ
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
