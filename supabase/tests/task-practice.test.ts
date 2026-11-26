// @vitest-environment node
import { beforeAll, describe, expect, it } from 'vitest';
import { createTestDb, type TestDb } from './harness.ts';

let t: TestDb;
let admin: string;
let drill: string; // answers the practice task
let manual: string; // ticks the task by hand first
let examinee: string; // takes the mini test and the mock
let outsider: string; // not enrolled

const mcq = (id: string, answer: string, tags: string[]) => ({
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
      slug: 'listening',
      name: 'Listening',
      chapters: [{ slug: 'part-3', name: 'Part 3', topics: [{ slug: 'p3-office', name: 'Công sở' }] }],
    },
    {
      slug: 'reading',
      name: 'Reading',
      chapters: [{ slug: 'part-5', name: 'Part 5', topics: [{ slug: 'p5-grammar', name: 'Ngữ pháp' }] }],
    },
  ],
};
const PART5 = {
  id: 'toeic-p5-001',
  section: 'reading',
  chapter: 'part-5',
  topic: 'p5-grammar',
  questions: [
    mcq('toeic-p5-001-1', 'A', ['tense', 'part5']),
    mcq('toeic-p5-001-2', 'A', ['tense', 'part5']),
    mcq('toeic-p5-001-3', 'A', ['part5']),
    mcq('toeic-p5-001-4', 'A', ['part5']),
    mcq('toeic-p5-001-5', 'A', ['passive', 'part5']),
  ],
};
const conversation = (n: number) => ({
  id: `toeic-p3-00${n}`,
  section: 'listening',
  chapter: 'part-3',
  topic: 'p3-office',
  questions: [1, 2, 3].map((i) => mcq(`toeic-p3-00${n}-${i}`, 'B', ['part3'])),
});
const MOCK_SET = {
  id: 'toeic-m1-r',
  section: 'reading',
  chapter: 'part-5',
  topic: 'p5-grammar',
  pool: 'mock',
  questions: [mcq('toeic-m1-r-1', 'A', []), mcq('toeic-m1-r-2', 'B', [])],
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
        [2, 495],
      ],
      sets: ['toeic-m1-r'],
    },
  ],
};

const task = (id: string, week: number, day: number, practice?: unknown) => ({
  id,
  week,
  day,
  skill: 'grammar',
  track: 'all',
  minutes: 30,
  title: id,
  group_activity: false,
  practice: practice ?? null,
});
const TASKS = [
  task('toeic-w1d1t1', 1, 1),
  task('toeic-w1d1t4', 1, 1, { kind: 'practice', tags: ['tense', 'part5'], count: 3 }),
  task('toeic-w1d5t1', 1, 5, {
    kind: 'exam',
    minutes: 30,
    parts: [
      { label: 'Listening', tags: ['part3'], count: 4 },
      { label: 'Reading', tags: ['part5'], count: 2 },
    ],
  }),
  task('toeic-w4d6t1', 4, 6, { kind: 'mock' }),
];

const qid = async (ext: string) =>
  (await t.db.query<{ id: number }>('select id from ot_questions where ext_id = $1', [ext])).rows[0].id;
const ext = async (ids: number[]) => {
  const { rows } = await t.db.query<{ id: number; ext_id: string }>(
    'select id, ext_id from ot_questions where id = any($1)',
    [ids],
  );
  const byId = new Map(rows.map((r) => [r.id, r.ext_id]));
  return ids.map((id) => byId.get(id));
};
const questionIds = (user: string, taskId: string) =>
  t
    .q<{ id: number }>(user, 'select id from ot_task_question_ids($1, 20) as id', [taskId])
    .then((rows) => ext(rows.map((r) => r.id)));

interface TaskInfo {
  id: string;
  answered: number;
  count: number;
  done: boolean;
}
const answer = async (
  user: string,
  question: string,
  response: string,
  taskId: string | null,
  mode = 'practice',
) => {
  const [{ r }] = await t.q<{ r: { is_correct: boolean; task: TaskInfo | null } }>(
    user,
    'select ot_answer_practice($1, $2, 1000, $3, $4) as r',
    [await qid(question), JSON.stringify(response), mode, taskId],
  );
  return r;
};
const ticked = (user: string, taskId: string) =>
  t.db
    .query<{ source: string }>('select source from task_progress where user_id = $1 and task_id = $2', [
      user,
      taskId,
    ])
    .then((r) => r.rows[0]?.source ?? null);

beforeAll(async () => {
  t = await createTestDb();
  admin = await t.signUp('admin@example.com');
  drill = await t.signUp('drill@example.com');
  manual = await t.signUp('manual@example.com');
  examinee = await t.signUp('examinee@example.com');
  outsider = await t.signUp('outsider@example.com');
  await t.makeAdmin(admin);
  for (const u of [drill, manual, examinee]) {
    await t.q(admin, `select admin_set_enrollment($1, 'toeic', 'approved', 'A')`, [u]);
  }
  await t.db.query('select ot_bank_upsert_taxonomy($1, $2)', ['toeic', JSON.stringify(TAXONOMY)]);
  for (const set of [PART5, conversation(1), conversation(2), MOCK_SET]) {
    await t.db.query('select ot_bank_upsert_set($1, $2, $3)', ['toeic', 'test.json', JSON.stringify(set)]);
  }
  await t.db.query('select ot_bank_upsert_mock($1, $2)', ['toeic', JSON.stringify(MOCK)]);
  await t.db.query('select content_upsert_roadmap_tasks($1, $2)', ['toeic', JSON.stringify(TASKS)]);
});

describe('roadmap tasks linked to the bank', () => {
  it('stores the link from the content sync and clears it when the link is removed', async () => {
    const read = async (id: string) =>
      (await t.db.query<{ practice: unknown }>('select practice from roadmap_tasks where id = $1', [id]))
        .rows[0].practice;
    expect(await read('toeic-w1d1t4')).toEqual({ kind: 'practice', tags: ['tense', 'part5'], count: 3 });
    expect(await read('toeic-w1d1t1')).toBeNull();

    await t.db.query('select content_upsert_roadmap_tasks($1, $2)', [
      'toeic',
      JSON.stringify([task('toeic-w2d1t4', 2, 1, { kind: 'practice', tags: ['part5'], count: 2 })]),
    ]);
    await t.db.query('select content_upsert_roadmap_tasks($1, $2)', [
      'toeic',
      JSON.stringify([task('toeic-w2d1t4', 2, 1)]),
    ]);
    expect(await read('toeic-w2d1t4')).toBeNull();
  });

  it('serves the narrow tag first and moves mastered questions to the back', async () => {
    expect(await questionIds(drill, 'toeic-w1d1t4')).toEqual([
      'toeic-p5-001-1',
      'toeic-p5-001-2',
      'toeic-p5-001-3',
      'toeic-p5-001-4',
      'toeic-p5-001-5',
    ]);
    await answer(drill, 'toeic-p5-001-1', 'A', null); // right: mastered for now
    await answer(drill, 'toeic-p5-001-2', 'C', null); // wrong: stays in front
    expect(await questionIds(drill, 'toeic-w1d1t4')).toEqual([
      'toeic-p5-001-2',
      'toeic-p5-001-3',
      'toeic-p5-001-4',
      'toeic-p5-001-5',
      'toeic-p5-001-1',
    ]);
  });

  it('refuses tasks without a practice link and learners outside the course', async () => {
    await expect(questionIds(drill, 'toeic-w1d1t1')).rejects.toThrow(/has no practice link/);
    await expect(questionIds(drill, 'toeic-w1d5t1')).rejects.toThrow(/has no practice link/);
    await expect(questionIds(outsider, 'toeic-w1d1t4')).rejects.toThrow(/not enrolled/);
  });

  it('counts answers towards the task and ticks it once the count is reached', async () => {
    const first = await answer(drill, 'toeic-p5-001-3', 'A', 'toeic-w1d1t4');
    expect(first.task).toEqual({ id: 'toeic-w1d1t4', answered: 1, count: 3, done: false });

    // Not counted: a question without the task's tags, and answers in review mode.
    expect((await answer(drill, 'toeic-p3-001-1', 'B', 'toeic-w1d1t4')).task).toBeNull();
    expect((await answer(drill, 'toeic-p5-001-4', 'A', 'toeic-w1d1t4', 'review')).task).toBeNull();

    await answer(drill, 'toeic-p5-001-4', 'B', 'toeic-w1d1t4'); // wrong answers count too
    expect(await ticked(drill, 'toeic-w1d1t4')).toBeNull();
    const third = await answer(drill, 'toeic-p5-001-5', 'A', 'toeic-w1d1t4');
    expect(third.task).toEqual({ id: 'toeic-w1d1t4', answered: 3, count: 3, done: true });
    expect(await ticked(drill, 'toeic-w1d1t4')).toBe('auto');

    const counts = await t.q<{ task_id: string; answered: number }>(
      drill,
      `select * from ot_task_answer_counts('toeic')`,
    );
    expect(counts).toEqual([{ task_id: 'toeic-w1d1t4', answered: 3 }]);
    expect(await t.q(manual, `select * from ot_task_answer_counts('toeic')`)).toEqual([]);
  });

  it('keeps a tick the learner made by hand', async () => {
    await t.q(manual, `insert into task_progress (course_id, task_id) values ('toeic', 'toeic-w1d1t4')`);
    for (const q of ['toeic-p5-001-1', 'toeic-p5-001-2', 'toeic-p5-001-3']) {
      await answer(manual, q, 'A', 'toeic-w1d1t4');
    }
    expect(await ticked(manual, 'toeic-w1d1t4')).toBe('manual');
    await expect(
      t.q(
        manual,
        `insert into task_progress (course_id, task_id, source) values ('toeic', 'toeic-w1d5t1', 'auto')`,
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it('builds the mini test from whole sets, part by part, and ticks the task on submit', async () => {
    const [{ id: attempt }] = await t.q<{ id: number }>(
      examinee,
      `select ot_start_task_exam('toeic-w1d5t1') as id`,
    );
    const rows = await t.q<{ question_id: number; sort: number }>(
      examinee,
      'select question_id, sort from ot_attempt_answers where attempt_id = $1 order by sort',
      [attempt],
    );
    expect(rows.map((r) => r.sort)).toEqual([0, 1, 2, 3, 4, 5]);
    const picked = await ext(rows.map((r) => r.question_id));
    const listening = picked.slice(0, 4);
    expect(listening.every((e) => e?.startsWith('toeic-p3-'))).toBe(true);
    // The first three come from one conversation, in order.
    const set = listening[0]!.slice(0, -2);
    expect(listening.slice(0, 3)).toEqual([`${set}-1`, `${set}-2`, `${set}-3`]);
    expect(picked.slice(4).every((e) => e?.startsWith('toeic-p5-001-'))).toBe(true);

    const [attemptRow] = await t.q<{ task_id: string; mode: string }>(
      examinee,
      'select task_id, mode from ot_attempts where id = $1',
      [attempt],
    );
    expect(attemptRow).toEqual({ task_id: 'toeic-w1d5t1', mode: 'exam' });

    expect(await ticked(examinee, 'toeic-w1d5t1')).toBeNull();
    await t.q(examinee, 'select ot_submit_exam($1)', [attempt]);
    expect(await ticked(examinee, 'toeic-w1d5t1')).toBe('auto');

    await expect(t.q(examinee, `select ot_start_task_exam('toeic-w1d1t4')`)).rejects.toThrow(
      /has no exam link/,
    );
    await expect(t.q(outsider, `select ot_start_task_exam('toeic-w1d5t1')`)).rejects.toThrow(/not enrolled/);
  });

  it("ticks the week's mock task when a mock test of that week is submitted", async () => {
    const [{ id: attempt }] = await t.q<{ id: number }>(
      examinee,
      `select ot_start_mock('toeic-mock-1') as id`,
    );
    expect(await ticked(examinee, 'toeic-w4d6t1')).toBeNull();
    await t.q(examinee, 'select ot_submit_exam($1)', [attempt]);
    expect(await ticked(examinee, 'toeic-w4d6t1')).toBe('auto');
  });
});
