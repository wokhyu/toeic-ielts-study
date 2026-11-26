// @vitest-environment node
import { beforeAll, describe, expect, it } from 'vitest';
import { createTestDb, type TestDb } from './harness.ts';

let t: TestDb;
let admin: string;
let learners: string[];

const mcq = (id: string, answer: string, tags: string[]) => ({
  id,
  type: 'mcq',
  stem_html: `Câu ${id}`,
  options: ['A', 'B', 'C', 'D'].map((label) => ({ label, html: label })),
  answer,
  explain_html: '',
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
const SET = {
  id: 'toeic-p5-001',
  section: 'reading',
  chapter: 'part-5',
  topic: 'p5-grammar',
  questions: [
    mcq('toeic-p5-001-1', 'A', ['passive']),
    mcq('toeic-p5-001-2', 'B', ['passive']),
    mcq('toeic-p5-001-3', 'C', ['tense']),
    mcq('toeic-p5-001-4', 'D', ['tense']),
  ],
};

// First answers of four learners (strongest first). Item 4 is answered correctly
// only by the two weakest learners, so it should discriminate negatively.
const FIRST: Record<string, string[]> = {
  'toeic-p5-001-1': ['A', 'A', 'B', 'C'],
  'toeic-p5-001-2': ['B', 'A', 'A', 'C'],
  'toeic-p5-001-3': ['C', 'C', 'C', 'A'],
  'toeic-p5-001-4': ['A', 'A', 'D', 'D'],
};
const KEY: Record<string, string> = {
  'toeic-p5-001-1': 'A',
  'toeic-p5-001-2': 'B',
  'toeic-p5-001-3': 'C',
  'toeic-p5-001-4': 'D',
};

const qid = async (ext: string) =>
  (await t.db.query<{ id: number }>('select id from ot_questions where ext_id = $1', [ext])).rows[0].id;
const answer = async (user: string, ext: string, response: string, time = 20000) =>
  t.q(user, 'select ot_answer_practice($1, $2, $3)', [await qid(ext), JSON.stringify(response), time]);

/** Reference implementation of the corrected point-biserial, independent of the SQL. */
function expectedRpb(ext: string): number {
  const items = Object.keys(FIRST);
  const right = (item: string, l: number) => FIRST[item][l] === KEY[item];
  const xs: number[] = [];
  const ys: number[] = [];
  for (let l = 0; l < 4; l++) {
    const others = items.filter((i) => i !== ext);
    xs.push(right(ext, l) ? 1 : 0);
    ys.push(others.filter((i) => right(i, l)).length / others.length);
  }
  const mean = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;
  const mx = mean(xs);
  const my = mean(ys);
  const cov = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0);
  const vx = xs.reduce((s, x) => s + (x - mx) ** 2, 0);
  const vy = ys.reduce((s, y) => s + (y - my) ** 2, 0);
  return cov / Math.sqrt(vx * vy);
}

beforeAll(async () => {
  t = await createTestDb();
  admin = await t.signUp('admin@example.com', 'Admin');
  await t.makeAdmin(admin);
  learners = [];
  for (const name of ['An', 'Bình', 'Chi', 'Dũng']) {
    const id = await t.signUp(`${name}@example.com`, name);
    learners.push(id);
    await t.q(admin, `select admin_set_enrollment($1, 'toeic', 'approved', 'A')`, [id]);
  }
  await t.q(admin, `select admin_set_enrollment($1, 'toeic', 'approved', 'B')`, [admin]);
  const pending = await t.signUp('pending@example.com', 'Chờ');
  await t.q(pending, `select request_enrollment('toeic')`);

  await t.db.query('select ot_bank_upsert_taxonomy($1, $2)', ['toeic', JSON.stringify(TAXONOMY)]);
  await t.db.query('select ot_bank_upsert_set($1, $2, $3)', ['toeic', 'test.json', JSON.stringify(SET)]);

  for (const [ext, picks] of Object.entries(FIRST)) {
    for (let l = 0; l < 4; l++) await answer(learners[l], ext, picks[l]);
  }
  // Later answers and the admin's answers must not change item statistics.
  await answer(learners[0], 'toeic-p5-001-2', 'D');
  await answer(admin, 'toeic-p5-001-1', 'D');
  // Dũng keeps missing passive-voice questions: 5 answers, none right.
  for (let i = 0; i < 3; i++) await answer(learners[3], 'toeic-p5-001-1', 'C');
  await t.q(learners[0], `insert into task_progress (course_id, task_id) values ('toeic', 'toeic-w1d1t1')`);
});

describe('admin analytics', () => {
  it('is for admins only', async () => {
    for (const sql of [
      `select admin_overview('toeic')`,
      `select * from admin_learners('toeic')`,
      `select * from admin_item_analysis('toeic')`,
    ]) {
      await expect(t.q(learners[0], sql)).rejects.toThrow(/admin only/);
    }
  });

  it('computes difficulty, corrected point-biserial and distractor counts on first answers', async () => {
    const rows = await t.q<{
      ext_id: string;
      n: number;
      p: number;
      r_pb: number;
      options: Record<string, number>;
      flags: string[];
      median_time_ms: number;
    }>(admin, `select * from admin_item_analysis('toeic', 4)`);
    const by = Object.fromEntries(rows.map((r) => [r.ext_id, r]));
    expect(by['toeic-p5-001-1']).toMatchObject({
      n: 4,
      p: 0.5,
      options: { A: 2, B: 1, C: 1 },
      median_time_ms: 20000,
    });
    for (const ext of Object.keys(FIRST)) expect(by[ext].r_pb).toBeCloseTo(expectedRpb(ext), 6);
    expect(by['toeic-p5-001-3'].r_pb).toBeGreaterThan(0);
    expect(by['toeic-p5-001-4'].r_pb).toBeLessThan(0);
    expect(by['toeic-p5-001-4'].flags).toContain('negative_discrimination');
    expect(by['toeic-p5-001-1'].flags).toContain('unused_distractor'); // nobody chose D
    expect(by['toeic-p5-001-2']).toMatchObject({ p: 0.25 });
  });

  it('holds back flags until enough learners have answered', async () => {
    const rows = await t.q<{ flags: string[] }>(admin, `select flags from admin_item_analysis('toeic')`);
    expect(rows.every((r) => r.flags.length === 0)).toBe(true);
  });

  it('summarises the class for a date range, without admin accounts', async () => {
    const [{ o }] = await t.q<{
      o: {
        kpis: Record<string, number>;
        daily: { answers: number; learners: number }[];
        funnel: Record<string, number>;
        tracks: Record<string, number>;
      };
    }>(admin, `select admin_overview('toeic') as o`);
    expect(o.kpis).toMatchObject({
      active_7d: 4,
      answers: 20,
      correct: 8,
      tasks: 1,
      pending: 1,
    });
    // 20 answers of 20 s each; the ticked task is a stub without minutes until the content sync.
    expect(o.kpis.study_minutes).toBe(7);
    expect(o.daily).toHaveLength(1);
    expect(o.daily[0]).toMatchObject({ answers: 20, learners: 4 });
    expect(o.funnel).toEqual({ requested: 5, approved: 4, started: 4, active_7d: 4 });
    expect(o.tracks).toEqual({ A: 4, B: 0, C: 0, none: 0 });

    const [{ today }] = (await t.db.query<{ today: string }>('select vn_today()::text as today')).rows;
    const [{ past }] = await t.q<{ past: { kpis: Record<string, number>; daily: unknown[] } }>(
      admin,
      `select admin_overview('toeic', $1::date - 60, $1::date - 31) as past`,
      [today],
    );
    expect(past.kpis.answers).toBe(0);
    expect(past.daily).toEqual([]);
    await expect(
      t.q(admin, `select admin_overview('toeic', $1::date, $1::date - 1)`, [today]),
    ).rejects.toThrow(/invalid date range/);
  });

  it('lists approved learners with activity sparkline, accuracy and weakest point', async () => {
    const rows = await t.q<{
      display_name: string;
      spark: number[];
      answers_30d: number;
      correct_30d: number;
      tasks_done: number;
      weakest_tag: string | null;
      weakest_n: number | null;
      current_streak: number;
    }>(admin, `select * from admin_learners('toeic')`);
    expect(rows.map((r) => r.display_name).sort()).toEqual(['An', 'Bình', 'Chi', 'Dũng']);
    const dung = rows.find((r) => r.display_name === 'Dũng')!;
    expect(dung.spark).toHaveLength(14);
    expect(dung.spark.at(-1)).toBe(7);
    expect(dung).toMatchObject({
      answers_30d: 7,
      correct_30d: 1,
      weakest_tag: 'passive',
      weakest_n: 5,
      current_streak: 1,
    });
    const an = rows.find((r) => r.display_name === 'An')!;
    expect(an).toMatchObject({ answers_30d: 5, tasks_done: 1, weakest_tag: null });
  });
});
