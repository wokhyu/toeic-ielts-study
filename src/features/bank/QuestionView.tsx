import { useContext } from 'react';
import { Rich } from '../../components/Rich.tsx';
import { IconCheck, IconX } from '../../components/icons.tsx';
import { Badge, inputClass } from '../../components/ui.tsx';
import { keyText } from '../../lib/bank.ts';
import { BankContext } from './context.ts';
import { TYPE_LABEL, type OtQuestion, type Response, type Reveal } from './data.ts';

/**
 * One question. Editable until `reveal` is set; then it shows the key, what the
 * learner picked and the explanation. The shared passage is drawn by the page.
 */
export function QuestionView({
  q,
  index,
  response,
  onChange,
  reveal,
  disabled,
}: {
  q: OtQuestion;
  index?: number;
  response: Response;
  onChange?: (r: Response) => void;
  reveal?: Reveal | null;
  disabled?: boolean;
}) {
  const course = useContext(BankContext)?.course;
  const locked = disabled || Boolean(reveal) || !onChange;
  const key = reveal?.answer_key;
  const explainLabel = course === 'on-tap-11' ? 'Lời giải' : 'Giải thích';

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {index !== undefined && (
          <span className="rounded-full bg-brand-soft px-2.5 py-0.5 text-sm font-semibold text-brand-ink">
            Câu {index}
          </span>
        )}
        {course === 'on-tap-11' && <Badge>{TYPE_LABEL[q.type]}</Badge>}
        {reveal && reveal.is_correct === true && (
          <Badge color="green">
            <IconCheck size={13} strokeWidth={3} /> Đúng
          </Badge>
        )}
        {reveal && reveal.is_correct === false && (
          <Badge color="red">
            <IconX size={13} strokeWidth={3} /> Chưa đúng
          </Badge>
        )}
        {reveal &&
          reveal.is_correct === false &&
          q.type === 'truefalse' &&
          typeof reveal.score === 'number' && <Badge color="yellow">{reveal.score / 100} điểm</Badge>}
      </div>
      {q.stem_html && (
        <div className="text-[15px] leading-relaxed">
          <Rich html={q.stem_html} />
        </div>
      )}

      {q.type === 'mcq' && (
        <div className="grid gap-2">
          {q.options.map((o) => {
            const picked = response === o.label;
            const isKey = typeof key === 'string' && key.toUpperCase() === o.label.toUpperCase();
            const tone = reveal
              ? isKey
                ? 'ring-2 ring-ok bg-ok-soft'
                : picked
                  ? 'ring-2 ring-bad bg-bad-soft'
                  : 'ring-1 ring-line opacity-70'
              : picked
                ? 'ring-2 ring-brand bg-brand-soft'
                : 'ring-1 ring-line bg-surface hover:bg-subtle hover:ring-line-strong';
            const letter = reveal
              ? isKey
                ? 'bg-ok text-on-solid'
                : picked
                  ? 'bg-bad text-on-solid'
                  : 'bg-muted text-ink-soft'
              : picked
                ? 'bg-brand text-on-solid'
                : 'bg-muted text-ink-soft';
            return (
              <button
                key={o.label}
                type="button"
                disabled={locked}
                onClick={() => onChange?.(o.label)}
                className={`flex items-start gap-3 rounded-xl p-3 text-left text-sm transition ${tone} ${reveal && isKey ? 'animate-pop' : ''}`}
              >
                <span
                  className={`grid h-6 min-w-6 shrink-0 place-items-center rounded-full px-1 text-xs font-semibold ${letter}`}
                >
                  {reveal && isKey ? (
                    <IconCheck size={13} strokeWidth={3} />
                  ) : reveal && picked ? (
                    <IconX size={13} strokeWidth={3} />
                  ) : (
                    o.label
                  )}
                </span>
                {o.html && (
                  <span className="pt-0.5">
                    <Rich html={o.html} />
                  </span>
                )}
                {reveal && isKey && <span className="sr-only">(đáp án đúng)</span>}
                {reveal && picked && !isKey && <span className="sr-only">(bạn chọn)</span>}
              </button>
            );
          })}
        </div>
      )}

      {q.type === 'truefalse' && (
        <div className="grid gap-2">
          {q.options.map((o) => {
            const current = (response && typeof response === 'object' ? response : {}) as Record<
              string,
              boolean
            >;
            const want = key && typeof key === 'object' && !Array.isArray(key) ? key[o.label] : undefined;
            return (
              <div
                key={o.label}
                className="flex flex-wrap items-start gap-2 rounded-xl bg-surface p-3 text-sm ring-1 ring-line"
              >
                <b>{o.label})</b>
                <span className="flex-1">
                  <Rich html={o.html} />
                </span>
                {[true, false].map((v) => (
                  <button
                    key={String(v)}
                    type="button"
                    disabled={locked}
                    onClick={() => onChange?.({ ...current, [o.label]: v })}
                    className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ${
                      current[o.label] === v
                        ? 'bg-brand text-on-solid ring-brand'
                        : 'ring-line-strong hover:bg-subtle'
                    } ${reveal && want === v ? 'outline-2 outline-offset-1 outline-ok' : ''}`}
                  >
                    {v ? 'Đúng' : 'Sai'}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {q.type === 'short' && (
        <div className="flex flex-wrap items-center gap-2">
          <input
            className={`${inputClass} max-w-64`}
            disabled={locked}
            value={typeof response === 'string' ? response : ''}
            onChange={(e) => onChange?.(e.target.value)}
            placeholder={course === 'on-tap-11' ? 'Nhập đáp số' : 'Nhập câu trả lời'}
          />
          {reveal && keyText(key ?? null) && (
            <span className="text-sm">
              Đáp án: <b>{keyText(key ?? null)}</b>
            </span>
          )}
        </div>
      )}

      {q.type === 'essay' && !reveal && (
        <p className="text-sm text-ink-muted">
          Câu tự luận không chấm tự động. Làm ra giấy rồi bấm xem lời giải.
        </p>
      )}

      {reveal && reveal.solution_html && (
        <details
          className={`rounded-xl p-3.5 text-sm ring-1 ${
            reveal.is_correct === false ? 'animate-rise bg-butter-soft ring-butter/50' : 'bg-subtle ring-line'
          }`}
          open={reveal.is_correct === false || q.type === 'essay' || course !== 'on-tap-11'}
        >
          <summary className="cursor-pointer font-medium text-ink">💡 {explainLabel}</summary>
          <div className="mt-2 leading-relaxed">
            <Rich html={reveal.solution_html} />
          </div>
        </details>
      )}
    </div>
  );
}
