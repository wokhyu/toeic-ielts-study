import { useCallback, useMemo, useState } from 'react';
import { speak } from '../../lib/speech.ts';
import { Badge, Button, Card, ErrorBox, Spinner } from '../../components/ui.tsx';
import { vocab } from '../../content/index.ts';
import { todayVN } from '../../lib/dates.ts';
import { positionOn } from '../../lib/roadmap.ts';
import { isDue, newCard, review, type CardState, type Rating } from '../../lib/srs.ts';
import { db, errorMessage } from '../../lib/supabase.ts';
import type { FlashcardReview } from '../../lib/types.ts';
import { unwrap, useAsync } from '../../lib/useAsync.ts';
import { useRoadmap } from './context.ts';

const BUTTONS: { rating: Rating; label: string; variant: 'danger' | 'secondary' | 'primary' }[] = [
  { rating: 'again', label: 'Quên', variant: 'danger' },
  { rating: 'hard', label: 'Khó', variant: 'secondary' },
  { rating: 'good', label: 'Nhớ', variant: 'primary' },
  { rating: 'easy', label: 'Dễ', variant: 'secondary' },
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
      return cards.filter((c) => c.week <= Math.max(currentWeek, 1) && isDue(states.get(c.id), today));
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
        { course_id: program, card_id: card.id, ...next, last_reviewed_at: new Date().toISOString() },
        { onConflict: 'user_id,card_id' },
      );
    if (err) setSaveError(errorMessage(err));
  };

  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-center gap-3">
        <select
          className="rounded-md border border-slate-300 px-2 py-1 text-sm"
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
        <Card className="mx-auto max-w-lg text-center">
          <button type="button" className="w-full py-8" onClick={() => setFlipped((f) => !f)}>
            <p className="text-3xl font-semibold">{card.word}</p>
            <p className="mt-2 text-slate-500">
              {card.ipa} · {card.pos}
            </p>
            {flipped ? (
              <div className="mt-6 space-y-2">
                <p className="text-lg text-indigo-700">{card.meaning_vi}</p>
                <p className="text-sm italic text-slate-600">{card.example}</p>
              </div>
            ) : (
              <p className="mt-6 text-sm text-slate-400">Bấm để lật thẻ</p>
            )}
          </button>
          <div className="flex justify-center">
            <Button
              variant="ghost"
              onClick={() => speak(card.word, program === 'toeic' ? 'en-US' : 'en-GB', 0.85)}
            >
              ▶ Phát âm
            </Button>
          </div>
          {flipped && (
            <div className="mt-4 grid grid-cols-4 gap-2">
              {BUTTONS.map((b) => (
                <Button key={b.rating} variant={b.variant} onClick={() => void rate(b.rating)}>
                  {b.label}
                </Button>
              ))}
            </div>
          )}
        </Card>
      ) : (
        <Card className="text-center text-sm text-slate-600">
          {week === 'due'
            ? 'Hôm nay không còn thẻ nào đến hạn. Quay lại vào ngày mai nhé.'
            : 'Đã ôn hết thẻ của tuần này.'}
        </Card>
      )}
      {saveError && <ErrorBox message={saveError} />}
    </div>
  );
}
