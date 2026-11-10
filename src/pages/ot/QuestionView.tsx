import { Rich } from '../../components/Rich.tsx';
import { Badge } from '../../components/ui.tsx';
import { TYPE_LABEL, type OtQuestion, type Response, type Reveal } from './data.ts';

/**
 * One on-tap-11 question. Editable until `reveal` is set; then it shows the key,
 * what the learner picked and the worked solution.
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
  const locked = disabled || Boolean(reveal) || !onChange;
  const key = reveal?.answer_key;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {index !== undefined && <span className="font-semibold">Câu {index}</span>}
        <Badge>{TYPE_LABEL[q.type]}</Badge>
        {reveal && reveal.is_correct === true && <Badge color="green">Đúng</Badge>}
        {reveal && reveal.is_correct === false && <Badge color="red">Sai</Badge>}
        {reveal &&
          reveal.is_correct === false &&
          q.type === 'truefalse' &&
          typeof reveal.score === 'number' && <Badge color="yellow">{reveal.score / 100} điểm</Badge>}
      </div>
      <div className="text-[15px] leading-relaxed">
        <Rich html={q.stem_html} />
      </div>

      {q.type === 'mcq' && (
        <div className="grid gap-2">
          {q.options.map((o) => {
            const picked = response === o.label;
            const isKey = typeof key === 'string' && key.toUpperCase() === o.label.toUpperCase();
            const tone = reveal
              ? isKey
                ? 'ring-emerald-400 bg-emerald-50'
                : picked
                  ? 'ring-rose-400 bg-rose-50'
                  : 'ring-slate-200'
              : picked
                ? 'ring-indigo-500 bg-indigo-50'
                : 'ring-slate-200 hover:bg-slate-50';
            return (
              <button
                key={o.label}
                type="button"
                disabled={locked}
                onClick={() => onChange?.(o.label)}
                className={`flex items-start gap-2 rounded-lg p-2.5 text-left text-sm ring-1 ${tone}`}
              >
                <b>{o.label}.</b>
                <Rich html={o.html} />
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
            const want = key && typeof key === 'object' ? key[o.label] : undefined;
            return (
              <div
                key={o.label}
                className="flex flex-wrap items-start gap-2 rounded-lg p-2.5 text-sm ring-1 ring-slate-200"
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
                    className={`rounded-md px-2.5 py-1 text-xs font-medium ring-1 ${
                      current[o.label] === v ? 'bg-indigo-600 text-white ring-indigo-600' : 'ring-slate-300'
                    } ${reveal && want === v ? 'outline outline-2 outline-emerald-500' : ''}`}
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
            className="w-48 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            disabled={locked}
            value={typeof response === 'string' ? response : ''}
            onChange={(e) => onChange?.(e.target.value)}
            placeholder="Nhập đáp số"
          />
          {reveal && typeof key === 'string' && (
            <span className="text-sm">
              Đáp án: <b>{key}</b>
            </span>
          )}
        </div>
      )}

      {q.type === 'essay' && !reveal && (
        <p className="text-sm text-slate-500">
          Câu tự luận không chấm tự động. Làm ra giấy rồi bấm xem lời giải.
        </p>
      )}

      {reveal && reveal.solution_html && (
        <details
          className="rounded-lg bg-slate-50 p-3 text-sm"
          open={reveal.is_correct === false || q.type === 'essay'}
        >
          <summary className="cursor-pointer font-medium">Lời giải</summary>
          <div className="mt-2 leading-relaxed">
            <Rich html={reveal.solution_html} />
          </div>
        </details>
      )}
    </div>
  );
}
