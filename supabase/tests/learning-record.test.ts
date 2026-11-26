// @vitest-environment node
import { beforeAll, describe, expect, it } from 'vitest';
import { createTestDb, type TestDb } from './harness.ts';

let t: TestDb;
let admin: string;
let learner: string;
let other: string;

const mcq = (id: string, answer: string, tags: string[] = []) => ({
  id,
  type: 'mcq',
  stem_html: `Câu ${id}`,
  options: ['A', 'B', 'C', 'D'].map((label) => ({ label, html: `${label} của ${id}` })),
  answer,
  explain_html: `Giải thích ${id}`,
  tags,
});

const TAXONOMY = {
  sections: [
    {
      slug: 'reading',
      name: 'Reading',
      chapters: [{ slug: 'part-5', name: 'Part 5', topics: [{ slug: 'p5-grammar', name: 'Ngữ pháp' }] }],
    },
  ],
};
const PRACTICE = {
  id: 'toeic-p5-001',
  section: 'reading',
  chapter: 'part-5',
  topic: 'p5-grammar',
  questions: [
    mcq('toeic-p5-001-1', 'B', ['passive']),
    mcq('toeic-p5-001-2', 'C'),
    mcq('toeic-p5-001-3', 'A'),
  ],
};
const MOCK_SET = {
  id: 'toeic-m1-r',
  section: 'reading',
  chapter: 'part-5',
  topic: 'p5-grammar',
  pool: 'mock',
  questions: [mcq('toeic-m1-r-1', 'A'), mcq('toeic-m1-r-2', 'B')],
};
const MOCK = {
  id: 'toeic-mock-1',
  title: 'Mock',
  minutes: 30,
  week: 4,
  sections: [
    {
      key: 'reading',
      label: 'Reading',
      scale: [
        [0, 5],
        [1, 250],
        [2, 495],
      ],
      sets: ['toeic-m1-r'],
    },
  ],
};

const qid = async (ext: string) =>
  (await t.db.query<{ id: number }>('select id from ot_questions where ext_id = $1', [ext])).rows[0].id;
const today = async () => (await t.db.query<{ d: string }>('select vn_today()::text as d')).rows[0].d;
const plusDays = (d: string, n: number) => {
  const x = new Date(`${d}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
};
const answer = (user: string, ext: string, response: string, time = 4200, mode = 'practice') =>
  qid(ext).then((id) =>
    t.q<{ r: { is_correct: boolean } }>(user, 'select ot_answer_practice($1, $2, $3, $4) as r', [
      id,
      JSON.stringify(response),
      time,
      mode,
    ]),
  );

beforeAll(async () => {
  t = await createTestDb();
  admin = await t.signUp('admin@example.com');
  learner = await t.signUp('learner@example.com');
  other = await t.signUp('other@example.com');
  await t.makeAdmin(admin);
  for (const u of [learner, other]) {
    await t.q(admin, `select admin_set_enrollment($1, 'toeic', 'approved', 'A')`, [u]);
  }
  await t.db.query('select ot_bank_upsert_taxonomy($1, $2)', ['toeic', JSON.stringify(TAXONOMY)]);
  for (const set of [PRACTICE, MOCK_SET]) {
    await t.db.query('select ot_bank_upsert_set($1, $2, $3)', ['toeic', 'test.json', JSON.stringify(set)]);
  }
  await t.db.query('select ot_bank_upsert_mock($1, $2)', ['toeic', JSON.stringify(MOCK)]);
});

describe('learning record', () => {
  it('records every practice answer with its result and time', async () => {
    await answer(learner, 'toeic-p5-001-1', 'A', 5300);
    await answer(learner, 'toeic-p5-001-1', 'B', 2100, 'review');
    const rows = await t.q<{ mode: string; is_correct: boolean; time_ms: number; response: string }>(
      learner,
      `select mode, is_correct, time_ms, response from ot_responses where question_id = $1 order by id`,
      [await qid('toeic-p5-001-1')],
    );
    expect(rows).toEqual([
      { mode: 'practice', is_correct: false, time_ms: 5300, response: 'A' },
      { mode: 'review', is_correct: true, time_ms: 2100, response: 'B' },
    ]);
  });

  it('caps implausible times and rejects unknown modes', async () => {
    await answer(learner, 'toeic-p5-001-3', 'A', 99_000_000);
    const [{ time_ms }] = await t.q<{ time_ms: number }>(
      learner,
      'select time_ms from ot_responses where question_id = $1',
      [await qid('toeic-p5-001-3')],
    );
    expect(time_ms).toBe(3_600_000);
    await expect(answer(learner, 'toeic-p5-001-3', 'A', 1000, 'exam')).rejects.toThrow(/invalid mode/);
  });

  it('shows learners only their own record; admins see everyone', async () => {
    await answer(other, 'toeic-p5-001-2', 'C');
    const own = await t.q<{ user_id: string }>(learner, 'select distinct user_id from ot_responses');
    expect(own.map((r) => r.user_id)).toEqual([learner]);
    const all = await t.q<{ n: number }>(admin, 'select count(distinct user_id)::int as n from ot_responses');
    expect(all[0].n).toBe(2);
  });

  it('does not let learners write the record or the statistics directly', async () => {
    const id = await qid('toeic-p5-001-2');
    await expect(
      t.q(
        learner,
        `insert into ot_responses (user_id, course_id, question_id, mode) values ($1, 'toeic', $2, 'practice')`,
        [learner, id],
      ),
    ).rejects.toThrow(/permission denied/);
    await expect(t.q(learner, 'select ot_bump_stats($1, $2, true)', [other, id])).rejects.toThrow(
      /permission denied/,
    );
  });

  it('schedules missed questions for review after 1, 3 and 7 days', async () => {
    const id = await qid('toeic-p5-001-2');
    const due = async () =>
      (
        await t.q<{ next_due: string | null; correct_streak: number }>(
          learner,
          'select next_due::text, correct_streak from ot_question_stats where question_id = $1',
          [id],
        )
      )[0];
    const d = await today();
    await answer(learner, 'toeic-p5-001-2', 'A');
    expect(await due()).toEqual({ next_due: plusDays(d, 1), correct_streak: 0 });
    await answer(learner, 'toeic-p5-001-2', 'C', 1000, 'review');
    expect(await due()).toEqual({ next_due: plusDays(d, 3), correct_streak: 1 });
    await answer(learner, 'toeic-p5-001-2', 'C', 1000, 'review');
    expect(await due()).toEqual({ next_due: plusDays(d, 7), correct_streak: 2 });
    await answer(learner, 'toeic-p5-001-2', 'C', 1000, 'review');
    expect(await due()).toEqual({ next_due: null, correct_streak: 3 });
  });

  it('records exam answers on submission, including blanks', async () => {
    const [{ topic }] = await t.q<{ topic: number }>(
      learner,
      `select topic_id as topic from ot_questions where ext_id = 'toeic-p5-001-1'`,
    );
    const [{ attempt }] = await t.q<{ attempt: number }>(
      learner,
      `select ot_start_exam(array[$1]::int[], 3, 30, array['mcq']) as attempt`,
      [topic],
    );
    const questions = await t.q<{ q: number }>(learner, 'select q from ot_attempt_questions($1) q', [
      attempt,
    ]);
    await t.q(learner, 'select ot_save_answer($1, $2, $3)', [attempt, questions[0].q, JSON.stringify('B')]);
    await t.q(learner, 'select ot_submit_exam($1)', [attempt]);
    const rows = await t.q<{ mode: string; response: unknown; time_ms: number | null }>(
      learner,
      'select mode, response, time_ms from ot_responses where attempt_id = $1 order by id',
      [attempt],
    );
    expect(rows).toHaveLength(3);
    expect(rows.every((r) => r.mode === 'exam')).toBe(true);
    expect(rows.filter((r) => r.response === null)).toHaveLength(2);
    expect(rows.find((r) => r.response !== null)?.time_ms).toBeGreaterThanOrEqual(0);
  });

  it('marks mock test scores as graded and keeps them out of learner hands', async () => {
    const [{ attempt }] = await t.q<{ attempt: number }>(
      learner,
      `select ot_start_mock('toeic-mock-1') as attempt`,
    );
    const qs = await t.q<{ q: number }>(learner, 'select q from ot_attempt_questions($1) q', [attempt]);
    await t.q(learner, 'select ot_save_answer($1, $2, $3)', [attempt, qs[0].q, JSON.stringify('A')]);
    await t.q(learner, 'select ot_submit_exam($1)', [attempt]);
    const scores = await t.q<{ source: string; attempt_id: number; total: string }>(
      learner,
      'select source, attempt_id, total::text from mock_scores',
    );
    expect(scores).toEqual([{ source: 'mock_test', attempt_id: attempt, total: '250' }]);
    const modes = await t.q<{ mode: string }>(
      learner,
      'select distinct mode from ot_responses where attempt_id = $1',
      [attempt],
    );
    expect(modes).toEqual([{ mode: 'mock' }]);

    await expect(
      t.q(
        learner,
        `insert into mock_scores (course_id, total, source, attempt_id) values ('toeic', 990, 'mock_test', $1)`,
        [attempt],
      ),
    ).rejects.toThrow(/row-level security/);
    await t.q(learner, `insert into mock_scores (course_id, total) values ('toeic', 600)`);
    await t.q(learner, 'delete from mock_scores');
    const left = await t.q<{ source: string }>(learner, 'select source from mock_scores');
    expect(left).toEqual([{ source: 'mock_test' }]);
    await expect(
      t.q(learner, `insert into mock_scores (course_id, total) values ('toeic', 1200)`),
    ).rejects.toThrow(/mock_scores_range/);
  });

  it('logs every flashcard review with the interval before and after', async () => {
    const upsert = (rating: string, interval: number) =>
      t.q(
        learner,
        `insert into flashcard_reviews (course_id, card_id, ease, interval_days, reps, due_date, last_rating)
         values ('toeic', 'toeic-v-001', 2.5, $1::int, 1, current_date + $1::int, $2)
         on conflict (user_id, card_id) do update set interval_days = excluded.interval_days, last_rating = excluded.last_rating`,
        [interval, rating],
      );
    await upsert('good', 1);
    await upsert('easy', 6);
    const log = await t.q<{ rating: string; interval_before: number; interval_after: number }>(
      learner,
      'select rating, interval_before, interval_after from flashcard_review_log order by id',
    );
    expect(log).toEqual([
      { rating: 'good', interval_before: 0, interval_after: 1 },
      { rating: 'easy', interval_before: 1, interval_after: 6 },
    ]);
  });

  it('keeps roadmap tasks as reference data and accepts ticks before the sync', async () => {
    await t.db.query('select content_upsert_roadmap_tasks($1, $2)', [
      'toeic',
      JSON.stringify([
        { id: 'toeic-w1d1t1', week: 1, day: 1, skill: 'reading', track: 'all', minutes: 20, title: 'Đọc đề' },
      ]),
    ]);
    await t.q(learner, `insert into task_progress (course_id, task_id) values ('toeic', 'toeic-w1d1t1')`);
    await t.q(learner, `insert into task_progress (course_id, task_id) values ('toeic', 'toeic-w9d9t9')`);
    const tasks = await t.q<{ id: string; week: number | null }>(
      learner,
      `select id, week from roadmap_tasks where id in ('toeic-w1d1t1', 'toeic-w9d9t9') order by id`,
    );
    expect(tasks).toEqual([
      { id: 'toeic-w1d1t1', week: 1 },
      { id: 'toeic-w9d9t9', week: null },
    ]);
    await expect(
      t.q(
        learner,
        `insert into task_progress (course_id, task_id, source) values ('toeic', 'toeic-w1d1t2', 'auto')`,
      ),
    ).rejects.toThrow(/row-level security/);
    await expect(
      t.q(learner, 'select content_upsert_roadmap_tasks($1, $2)', ['toeic', '[]']),
    ).rejects.toThrow(/permission denied/);
  });

  it('audits admin decisions and hides the log from learners', async () => {
    await t.q(admin, `select admin_set_enrollment($1, 'ielts', 'approved', 'B')`, [other]);
    const log = await t.q<{ action: string; target_user: string; course: string }>(
      admin,
      `select action, target_user, details ->> 'course' as course from admin_audit_log
        where target_user = $1 order by id desc limit 1`,
      [other],
    );
    expect(log).toEqual([{ action: 'set_enrollment', target_user: other, course: 'ielts' }]);
    expect(await t.q(learner, 'select * from admin_audit_log')).toEqual([]);
  });

  it('combines all activity by Vietnam date, per learner', async () => {
    const kinds = await t.q<{ kind: string }>(
      learner,
      'select distinct kind from learner_activity order by kind',
    );
    expect(kinds.map((k) => k.kind)).toEqual(['exam', 'flashcard', 'mock', 'practice', 'review', 'task']);
    const users = await t.q<{ user_id: string }>(learner, 'select distinct user_id from learner_activity');
    expect(users).toEqual([{ user_id: learner }]);
    const [{ day }] = await t.q<{ day: string }>(
      learner,
      'select max(day)::text as day from learner_activity',
    );
    expect(day).toBe(await today());
  });
});
