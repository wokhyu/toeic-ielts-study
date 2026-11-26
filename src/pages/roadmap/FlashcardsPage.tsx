import { useCallback, useMemo, useState } from 'react';
import { speak } from '../../lib/speech.ts';
import { Badge, Button, Card, EmptyState, ErrorBox, selectClass, Spinner } from '../../components/ui.tsx';
import { vocab } from '../../content/index.ts';
import { todayVN } from '../../lib/dates.ts';
import { positionOn } from '../../lib/roadmap.ts';
import { dueCards, newCard, review, type CardState, type Rating } from '../../lib/srs.ts';
import { db, errorMessage } from '../../lib/supabase.ts';
import type { FlashcardReview } from '../../lib/types.ts';
import { unwrap, useAsync } from '../../lib/useAsync.ts';
import { useRoadmap } from './context.ts';

const BUTTONS: { rating: Rating; label: string; hint: string; tone: string }[] = [
  { rating: 'again', label: 'Quên', hint: 'gặp lại ngày mai', tone: 'bg-bad-soft text-bad-ink ring-bad/30' },
  { rating: 'hard', label: 'Khó', hint: 'nhắc sớm hơn', tone: 'bg-warn-soft text-warn-ink ring-warn/30' },
  {
    rating: 'good',
    label: 'Nhớ',
    hint: 'giãn khoảng ôn',
    tone: 'bg-brand-soft text-brand-ink ring-brand/30',
  },
  { rating: 'easy', label: 'Dễ', hint: 'lâu nữa mới ôn', tone: 'bg-ok-soft text-ok-ink ring-ok/30' },
];

export function FlashcardsPage() {
  const { program, startDate, preview } = useRoadmap();
  const today = todayVN();
  const currentWeek = startDate ? positionOn(startDate, today).week : 1;
  const [week, setWeek] = useState<number | 'due'>('due');
  const [flipped, setFlipped] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [states, setStates] = useState<Map<string, CardState>>(new Map());
  const [index, setIndex] = useState(0);

  const load = useCallback(async () => {
    if (preview) return new Map<string, CardState>();
    const rows = unwrap(
      await db().from('flashcard_reviews').select('*').eq('course_id', program),
    ) as FlashcardReview[];
    const m = new Map(rows.map((r) => [r.card_id, r as CardState]));
    setStates(m);
    return m;
  }, [program, preview]);
  const { loading, error } = useAsync(load);

  const deck = useMemo(() => {
    const cards = vocab[program];
    if (week === 'due') {
      // Cards from weeks already reached that are due (new cards count as due).
      return dueCards(cards, states, currentWeek, today);
    }
    return cards.filter((c) => c.week === week);
    // `states` is intentionally read once per deck change so the queue does not reshuffle mid-session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [program, week, currentWeek, today, loading]);

  if (loading) return <Spinner />;
  if (error) return <ErrorBox message={error} />;

  const card = deck[index];
  const learned = [...states.values()].filter((s) => s.reps > 0).length;

  const rate = async (rating: Rating) => {
    if (!card) return;
    const next = review(states.get(card.id) ?? newCard(today), rating, today);
    setStates((m) => new Map(m).set(card.id, next));
    setFlipped(false);
    setIndex((i) => i + 1);
    if (preview) return;
    const { error: err } = await db()
      .from('flashcard_reviews')
      .upsert(
        { course_id: program, card_id: card.id, ...next, last_rating: rating },
        { onConflict: 'user_id,card_id' },
      );
    if (err) setSaveError(errorMessage(err));
  };

  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-center gap-3">
        <select
          className={selectClass}
          aria-label="Chọn bộ thẻ"
          value={String(week)}
          onChange={(e) => {
            setWeek(e.target.value === 'due' ? 'due' : Number(e.target.value));
            setIndex(0);
            setFlipped(false);
          }}
        >
          <option value="due">Thẻ đến hạn hôm nay</option>
          {Array.from({ length: 12 }, (_, i) => (
            <option key={i} value={i + 1}>
              Tuần {i + 1}
            </option>
          ))}
        </select>
        <Badge>
          Đã thuộc {learned}/{vocab[program].length}
        </Badge>
        <Badge color="blue">Còn {Math.max(deck.length - index, 0)} thẻ</Badge>
      </Card>

      {card ? (
        <div className="mx-auto max-w-lg">
          <div key={card.id} className="flip-scene animate-rise">
            <button
              type="button"
              className={`flip-card relative grid h-72 w-full ${flipped ? 'is-flipped' : ''}`}
              onClick={() => setFlipped((f) => !f)}
              aria-label={flipped ? 'Lật về mặt trước' : 'Lật thẻ để xem nghĩa'}
            >
              <span className="flip-face absolute inset-0 flex flex-col items-center justify-center rounded-[var(--radius-card)] bg-surface p-6 shadow-lift ring-1 ring-line [grid-area:1/1]">
                <span className="text-xs font-medium tracking-wide text-accent-ink uppercase">
                  Tuần {card.week}
                </span>
                <span className="mt-3 text-4xl font-semibold text-ink">{card.word}</span>
                <span className="mt-2 text-ink-muted">
                  {card.ipa} · {card.pos}
                </span>
                <span className="mt-8 text-sm text-ink-faint">Bấm để lật thẻ</span>
              </span>
              <span
                className="flip-face flip-back absolute inset-0 flex flex-col items-center justify-center rounded-[var(--radius-card)] bg-brand-soft p-6 shadow-lift ring-1 ring-brand/20 [grid-area:1/1]"
                aria-hidden={!flipped}
              >
                <span className="text-2xl font-semibold text-brand-ink">{card.meaning_vi}</span>
                <span className="mt-3 text-sm text-ink-soft italic">{card.example}</span>
                <span className="mt-6 text-sm text-ink-muted">{card.word}</span>
              </span>
            </button>
          </div>
          <div className="mt-3 flex justify-center">
            <Button
              variant="ghost"
              onClick={() => speak(card.word, program === 'toeic' ? 'en-US' : 'en-GB', 0.85)}
            >
              ▶ Phát âm
            </Button>
          </div>
          {flipped && (
            <div className="mt-3 grid animate-rise grid-cols-2 gap-2 sm:grid-cols-4">
              {BUTTONS.map((b) => (
                <button
                  key={b.rating}
                  type="button"
                  onClick={() => void rate(b.rating)}
                  className={`flex flex-col items-center rounded-2xl px-3 py-2.5 ring-1 transition hover:-translate-y-0.5 active:scale-95 ${b.tone}`}
                >
                  <span className="font-semibold">{b.label}</span>
                  <span className="text-xs opacity-80">{b.hint}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <EmptyState
          title={week === 'due' ? 'Xong hết thẻ hôm nay rồi!' : 'Đã ôn hết thẻ của tuần này'}
          mood="cheer"
        >
          {week === 'due'
            ? 'Không còn thẻ nào đến hạn. Ngày mai Bé Cú sẽ nhắc bạn ôn tiếp.'
            : 'Chọn tuần khác ở trên hoặc quay lại phần thẻ đến hạn.'}
        </EmptyState>
      )}
      {saveError && <ErrorBox message={saveError} />}
    </div>
  );
}
