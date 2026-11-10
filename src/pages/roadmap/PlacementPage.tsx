import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { SpeakButton } from '../../components/Speak.tsx';
import { Badge, Button, Card, ErrorBox, Field, inputClass, Notice } from '../../components/ui.tsx';
import { placementTests, productiveTest, scoring } from '../../content/index.ts';
import type { PlacementQuestion, RubricCriterion, Track } from '../../content/schema.ts';
import { useAuth } from '../../lib/auth-context.ts';
import { nextMonday, todayVN } from '../../lib/dates.ts';
import {
  adjustForProductive,
  countCorrect,
  isValidRealScore,
  trackFromCorrect,
  trackFromRealScore,
  type Answers,
} from '../../lib/placement.ts';
import { db, errorMessage } from '../../lib/supabase.ts';
import { useRoadmap } from './context.ts';

type Mode = 'choose' | 'real' | 'test' | 'done';

/** Consecutive questions sharing a passage or audio script are shown under one heading. */
function groupQuestions(qs: PlacementQuestion[]) {
  const groups: { key: string; questions: PlacementQuestion[] }[] = [];
  for (const q of qs) {
    const key = `${q.section}|${q.part}|${q.audio_script ?? q.passage ?? q.id}`;
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.questions.push(q);
    else groups.push({ key, questions: [q] });
  }
  return groups;
}

const LETTERS = ['A', 'B', 'C', 'D'];

export function PlacementPage() {
  const { program, enrollment, preview } = useRoadmap();
  const { refresh } = useAuth();
  const [mode, setMode] = useState<Mode>('choose');
  const [answers, setAnswers] = useState<Answers>({});
  const [real, setReal] = useState('');
  const [writingLevel, setWritingLevel] = useState<Track | ''>('');
  const [speakingLevel, setSpeakingLevel] = useState<Track | ''>('');
  const [essay, setEssay] = useState('');
  const [result, setResult] = useState<{ track: Track; correct?: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const questions = placementTests[program];
  const groups = useMemo(() => groupQuestions(questions), [questions]);
  const answeredCount = Object.values(answers).filter(Boolean).length;
  const canSave = !preview && enrollment?.status === 'approved';

  const save = async (track: Track, row: Record<string, unknown>) => {
    if (!canSave) return;
    const ins = await db()
      .from('placement_results')
      .insert({ course_id: program, track, ...row });
    if (ins.error) throw ins.error;
    const upd = await db()
      .from('enrollments')
      .update({ track, start_date: enrollment?.start_date ?? nextMonday(todayVN()) })
      .eq('course_id', program);
    if (upd.error) throw upd.error;
    await refresh();
  };

  const finish = async (track: Track, correct: number | undefined, row: Record<string, unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await save(track, row);
      setResult({ track, correct });
      setMode('done');
      window.scrollTo({ top: 0 });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const submitReal = () => {
    const score = Number(real.replace(',', '.'));
    if (!isValidRealScore(program, score)) {
      setError(
        program === 'toeic' ? 'Điểm TOEIC từ 10 đến 990, bước 5.' : 'Band IELTS từ 0 đến 9, bước 0.5.',
      );
      return;
    }
    void finish(trackFromRealScore(scoring, program, score), undefined, {
      source: 'real_score',
      real_score: score,
    });
  };

  const submitTest = () => {
    const correct = countCorrect(questions, answers);
    let track = trackFromCorrect(scoring, program, correct);
    if (program === 'ielts' && writingLevel && speakingLevel) {
      track = adjustForProductive(track, writingLevel, speakingLevel);
    }
    void finish(track, correct, {
      source: 'test',
      answers: {
        ...answers,
        writing_self: writingLevel || null,
        speaking_self: speakingLevel || null,
        essay,
      },
      correct_count: correct,
      total: questions.length,
    });
  };

  if (mode === 'choose') {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        {!canSave && (
          <div className="sm:col-span-2">
            <Notice>
              Chế độ xem trước: làm thử được, nhưng kết quả không được lưu.
              {preview &&
                enrollment?.status !== 'approved' &&
                ' Đăng ký khóa học để lưu kết quả và nhận lộ trình.'}
            </Notice>
          </div>
        )}
        <Card>
          <h2 className="font-semibold">Tôi đã có điểm thi thật</h2>
          <p className="mt-1 text-sm text-slate-600">Điểm {program.toUpperCase()} trong 12 tháng gần nhất.</p>
          <Button className="mt-4" variant="secondary" onClick={() => setMode('real')}>
            Nhập điểm
          </Button>
        </Card>
        <Card>
          <h2 className="font-semibold">Tôi chưa biết trình độ</h2>
          <p className="mt-1 text-sm text-slate-600">
            {questions.length} câu trắc nghiệm{program === 'ielts' ? ' + tự chấm Writing/Speaking' : ''},
            khoảng 40 phút. Phần Listening được đọc bằng giọng máy.
          </p>
          <Button className="mt-4" onClick={() => setMode('test')}>
            Làm bài test
          </Button>
        </Card>
      </div>
    );
  }

  if (mode === 'real') {
    return (
      <Card className="max-w-md">
        <Field label={program === 'toeic' ? 'Tổng điểm TOEIC (10–990)' : 'Overall band IELTS (0–9)'}>
          <input
            className={inputClass}
            inputMode="decimal"
            value={real}
            onChange={(e) => setReal(e.target.value)}
          />
        </Field>
        {error && (
          <div className="mt-3">
            <ErrorBox message={error} />
          </div>
        )}
        <div className="mt-4 flex gap-2">
          <Button onClick={submitReal} disabled={busy}>
            Xếp nhánh
          </Button>
          <Button variant="ghost" onClick={() => setMode('choose')}>
            Quay lại
          </Button>
        </div>
      </Card>
    );
  }

  if (mode === 'done' && result) {
    const t = scoring[program].thresholds.find((x) => x.track === result.track)!;
    return (
      <div className="space-y-4">
        <Card>
          <h2 className="text-lg font-semibold">
            {t.label} · mục tiêu {t.target}
          </h2>
          {result.correct !== undefined && (
            <p className="mt-1 text-sm text-slate-600">
              Đúng {result.correct}/{questions.length} câu.
            </p>
          )}
          <p className="mt-2 text-xs text-slate-500">{scoring.note}</p>
          {canSave && (
            <Link
              to={`/c/${program}/hom-nay`}
              className="mt-4 inline-block text-sm font-medium text-indigo-700 underline"
            >
              Xem nhiệm vụ hôm nay
            </Link>
          )}
        </Card>
        {result.correct !== undefined && <AnswerReview questions={questions} answers={answers} />}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {groups.map((g) => {
        const first = g.questions[0];
        return (
          <Card key={g.key}>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge color="blue">
                {first.section === 'listening' ? 'Listening' : 'Reading'} · {first.part}
              </Badge>
              {first.audio_script && first.voice && (
                <SpeakButton text={first.audio_script} lang={first.voice} />
              )}
            </div>
            {first.passage && (
              <pre className="mb-4 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 font-sans text-sm leading-relaxed">
                {first.passage}
              </pre>
            )}
            <ol className="space-y-4">
              {g.questions.map((q) => (
                <li key={q.id}>
                  <p className="text-sm font-medium">
                    {questions.indexOf(q) + 1}. {q.question}
                  </p>
                  <div className="mt-2 grid gap-1.5">
                    {q.options.map((opt, i) => (
                      <label key={opt} className="flex cursor-pointer items-start gap-2 text-sm">
                        <input
                          type="radio"
                          name={q.id}
                          className="mt-0.5 accent-indigo-600"
                          checked={answers[q.id] === LETTERS[i]}
                          onChange={() => setAnswers((a) => ({ ...a, [q.id]: LETTERS[i] }))}
                        />
                        <span>
                          <b>{LETTERS[i]}.</b> {opt}
                        </span>
                      </label>
                    ))}
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        );
      })}

      {program === 'ielts' && (
        <Card>
          <h2 className="font-semibold">Writing và Speaking (tự chấm)</h2>
          <p className="mt-2 text-sm">
            <b>
              Writing ({productiveTest.writing.minutes} phút, ít nhất {productiveTest.writing.min_words} từ):
            </b>{' '}
            {productiveTest.writing.prompt}
          </p>
          <textarea
            className={`${inputClass} mt-2 h-40`}
            value={essay}
            onChange={(e) => setEssay(e.target.value)}
            placeholder="Viết bài ở đây (không bắt buộc)"
          />
          <p className="mt-1 text-xs text-slate-500">{essay.trim().split(/\s+/).filter(Boolean).length} từ</p>
          <Rubric criteria={productiveTest.writing.rubric} value={writingLevel} onChange={setWritingLevel} />

          <div className="mt-5 text-sm">
            <b>Speaking Part 1:</b> trả lời to từng câu và tự ghi âm.
            <ul className="ml-5 mt-1 list-disc">
              {productiveTest.speaking.part1.map((q) => (
                <li key={q}>{q}</li>
              ))}
            </ul>
            <p className="mt-2">
              <b>Part 2</b> (chuẩn bị {productiveTest.speaking.part2.prep_seconds} giây, nói{' '}
              {productiveTest.speaking.part2.talk_seconds / 60} phút): {productiveTest.speaking.part2.cue} You
              should say: {productiveTest.speaking.part2.bullets.join('; ')}.
            </p>
          </div>
          <Rubric
            criteria={productiveTest.speaking.rubric}
            value={speakingLevel}
            onChange={setSpeakingLevel}
          />
        </Card>
      )}

      <Card className="sticky bottom-2 flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm text-slate-600">
          Đã trả lời {answeredCount}/{questions.length} câu
        </span>
        {error && <ErrorBox message={error} />}
        <Button onClick={submitTest} disabled={busy}>
          Nộp bài
        </Button>
      </Card>
    </div>
  );
}

function Rubric({
  criteria,
  value,
  onChange,
}: {
  criteria: RubricCriterion[];
  value: Track | '';
  onChange: (t: Track) => void;
}) {
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full min-w-[560px] text-left text-xs">
        <thead>
          <tr className="text-slate-500">
            <th className="p-1.5">Tiêu chí</th>
            <th className="p-1.5">Mức A</th>
            <th className="p-1.5">Mức B</th>
            <th className="p-1.5">Mức C</th>
          </tr>
        </thead>
        <tbody>
          {criteria.map((c) => (
            <tr key={c.name} className="border-t border-slate-100 align-top">
              <td className="p-1.5 font-medium">{c.name}</td>
              <td className="p-1.5">{c.levels.A}</td>
              <td className="p-1.5">{c.levels.B}</td>
              <td className="p-1.5">{c.levels.C}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-2 flex items-center gap-3 text-sm">
        Mức tổng thể gần nhất:
        {(['A', 'B', 'C'] as const).map((t) => (
          <label key={t} className="flex items-center gap-1">
            <input
              type="radio"
              checked={value === t}
              onChange={() => onChange(t)}
              className="accent-indigo-600"
            />{' '}
            {t}
          </label>
        ))}
      </div>
    </div>
  );
}

function AnswerReview({ questions, answers }: { questions: PlacementQuestion[]; answers: Answers }) {
  return (
    <Card>
      <h2 className="mb-3 font-semibold">Đáp án và giải thích</h2>
      <ol className="space-y-3 text-sm">
        {questions.map((q, i) => {
          const ok = answers[q.id] === q.answer;
          return (
            <li key={q.id} className="border-t border-slate-100 pt-3">
              <p>
                <b>{i + 1}.</b> {q.question}{' '}
                <Badge color={ok ? 'green' : 'red'}>
                  {ok ? 'Đúng' : `Sai (chọn ${answers[q.id] ?? '—'}, đáp án ${q.answer})`}
                </Badge>
              </p>
              <p className="mt-1 text-slate-600">{q.explain_vi}</p>
              {q.audio_script && (
                <details className="mt-1 text-slate-500">
                  <summary className="cursor-pointer">Script</summary>
                  <pre className="whitespace-pre-wrap font-sans">{q.audio_script}</pre>
                </details>
              )}
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
