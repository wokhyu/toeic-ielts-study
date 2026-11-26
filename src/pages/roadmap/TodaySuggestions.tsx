import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { IconCards, IconRepeat, IconTarget } from '../../components/icons.tsx';
import { InfoHint, Skeleton } from '../../components/ui.tsx';
import { tagLabel } from '../../content/bank.ts';
import { vocab } from '../../content/index.ts';
import type { Program } from '../../content/schema.ts';
import type { Progress } from '../../features/progress/data.ts';
import { dueCards } from '../../lib/srs.ts';
import { weakest } from '../../lib/stats.ts';
import { db } from '../../lib/supabase.ts';
import { unwrap, useAsync } from '../../lib/useAsync.ts';

/** "Gợi ý hôm nay": what is worth doing besides the day's tasks. */
export function TodaySuggestions({
  program,
  currentWeek,
  today,
}: {
  program: Program;
  currentWeek: number;
  today: string;
}) {
  const load = useCallback(async () => {
    const [progress, cards] = await Promise.all([
      db().rpc('learner_progress', { p_course: program }),
      db().from('flashcard_reviews').select('card_id, due_date').eq('course_id', program),
    ]);
    const p = unwrap(progress) as Progress;
    const states = new Map(
      (unwrap(cards) as { card_id: string; due_date: string }[]).map((c) => [c.card_id, c]),
    );
    const weak = weakest(
      p.by_tag.map((t) => ({ tag: t.tag, n: t.n_30d, correct: t.correct_30d })),
      1,
    )[0];
    return {
      cards: dueCards(vocab[program], states, currentWeek, today).length,
      reviews: p.totals.due_reviews,
      weak,
    };
  }, [program, currentWeek, today]);
  const { data, loading, error } = useAsync(load);

  if (error) return null; // Suggestions are optional; the tasks below still work.
  const base = `/c/${program}`;
  const tile =
    'flex items-center gap-3 rounded-2xl bg-surface p-3.5 shadow-soft ring-1 ring-line transition hover:-translate-y-0.5 hover:shadow-lift';

  return (
    <section aria-labelledby="goi-y">
      <div className="mb-2 flex items-center gap-2">
        <h2 id="goi-y" className="font-semibold text-ink">
          Gợi ý hôm nay
        </h2>
        <InfoHint label="gợi ý hôm nay">
          Ngoài nhiệm vụ trong ngày: thẻ từ vựng đến hạn ôn, câu từng làm sai đến hạn làm lại, và chủ điểm bạn
          đang yếu nhất trong 30 ngày qua (tính trên các chủ điểm đã làm từ 5 câu).
        </InfoHint>
      </div>
      {loading || !data ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-3">
          <Link to={`${base}/flashcard`} className={tile}>
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-butter-soft text-warn-ink">
              <IconCards />
            </span>
            <span>
              <span className="block font-semibold text-ink">{data.cards} thẻ</span>
              <span className="text-xs text-ink-muted">đến hạn ôn</span>
            </span>
          </Link>
          <Link to={`${base}/luyen/on-lai`} className={tile}>
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent-soft text-accent-ink">
              <IconRepeat />
            </span>
            <span>
              <span className="block font-semibold text-ink">{data.reviews} câu sai</span>
              <span className="text-xs text-ink-muted">đến hạn làm lại</span>
            </span>
          </Link>
          {data.weak ? (
            <Link to={`${base}/luyen/the/${data.weak.tag}`} className={tile}>
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-soft text-brand-ink">
                <IconTarget />
              </span>
              <span className="min-w-0">
                <span className="block truncate font-semibold text-ink">
                  {tagLabel(program, data.weak.tag)}
                </span>
                <span className="text-xs text-ink-muted">
                  đúng {Math.round((data.weak.correct / data.weak.n) * 100)}% · luyện thêm
                </span>
              </span>
            </Link>
          ) : (
            <Link to={`${base}/luyen`} className={tile}>
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-soft text-brand-ink">
                <IconTarget />
              </span>
              <span>
                <span className="block font-semibold text-ink">Luyện đề</span>
                <span className="text-xs text-ink-muted">làm thêm để Bé Cú tìm điểm yếu</span>
              </span>
            </Link>
          )}
        </div>
      )}
    </section>
  );
}
