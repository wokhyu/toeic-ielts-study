// @vitest-environment node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { BADGES } from '../../src/content/badges.ts';
import { createTestDb, type TestDb } from './harness.ts';

let t: TestDb;
let admin: string;
let learner: string;
let other: string;
let outsider: string;

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
      chapters: [
        { slug: 'part-5', name: 'Part 5', sort: 5, topics: [{ slug: 'p5-grammar', name: 'Ngữ pháp' }] },
        { slug: 'part-6', name: 'Part 6', sort: 6, topics: [{ slug: 'p6-text', name: 'Đoạn văn' }] },
      ],
    },
  ],
};
const P5 = {
  id: 'toeic-p5-001',
  section: 'reading',
  chapter: 'part-5',
  topic: 'p5-grammar',
  questions: [
    mcq('toeic-p5-001-1', 'A', ['passive']),
    mcq('toeic-p5-001-2', 'B', ['passive']),
    mcq('toeic-p5-001-3', 'C', ['tense']),
  ],
};
const P6 = {
  id: 'toeic-p6-001',
  section: 'reading',
  chapter: 'part-6',
  topic: 'p6-text',
  questions: [mcq('toeic-p6-001-1', 'D', ['p6-context'])],
};

const qid = async (ext: string) =>
  (await t.db.query<{ id: number }>('select id from ot_questions where ext_id = $1', [ext])).rows[0].id;
const answer = async (user: string, ext: string, response: string, mode = 'practice') =>
  t.q(user, 'select ot_answer_practice($1, $2, 3000, $3)', [await qid(ext), JSON.stringify(response), mode]);
const today = async () => (await t.db.query<{ d: string }>('select vn_today()::text as d')).rows[0].d;

interface Progress {
  today: string;
  streak: { current_streak: number; longest_streak: number; active_days: number; last_day: string | null };
  heatmap: { day: string; answers: number; tasks: number; cards: number }[];
  totals: Record<string, number | null>;
  by_chapter: { name: string; n: number; correct: number }[];
  by_tag: { tag: string; n: number; correct: number }[];
  mock_scores: { total: number; source: string }[];
  badges: { id: string }[];
}
const progress = async (user: string, of?: string) =>
  (await t.q<{ p: Progress }>(user, 'select learner_progress($1, $2) as p', ['toeic', of ?? null]))[0].p;
const achievements = (user: string) =>
  t.q<{ badge_id: string; is_new: boolean }>(
    user,
    `select badge_id, is_new from learner_achievements('toeic')`,
  );

// Flashcard reviews on given days ago (Vietnam noon), to build streaks without touching the roadmap.
const reviewDaysAgo = (user: string, daysAgo: number[]) =>
  Promise.all(
    daysAgo.map((n) =>
      t.db.query(
        `insert into flashcard_review_log (user_id, course_id, card_id, rating, interval_after, reviewed_at)
         values ($1, 'toeic', 'toeic-v001', 'good', 1,
                 ((vn_today() - $2::int)::timestamp + interval '12 hours') at time zone 'Asia/Ho_Chi_Minh')`,
        [user, n],
      ),
    ),
  );

beforeAll(async () => {
  t = await createTestDb();
  admin = await t.signUp('admin@example.com');
  learner = await t.signUp('learner@example.com', 'Lan');
  other = await t.signUp('other@example.com', 'Minh');
  outsider = await t.signUp('outsider@example.com');
  await t.makeAdmin(admin);
  for (const u of [learner, other])
    await t.q(admin, `select admin_set_enrollment($1, 'toeic', 'approved', 'A')`, [u]);
  await t.db.query('select ot_bank_upsert_taxonomy($1, $2)', ['toeic', JSON.stringify(TAXONOMY)]);
  for (const set of [P5, P6]) {
    await t.db.query('select ot_bank_upsert_set($1, $2, $3)', ['toeic', 'test.json', JSON.stringify(set)]);
  }
  await t.db.query('select content_upsert_roadmap_tasks($1, $2)', [
    'toeic',
    JSON.stringify([
      { id: 'toeic-w1d1t1', week: 1, day: 1, skill: 'reading', track: 'all', minutes: 20, title: 'a' },
      { id: 'toeic-w1d1t2', week: 1, day: 1, skill: 'vocab', track: 'A', minutes: 15, title: 'b' },
      { id: 'toeic-w1d2t1', week: 1, day: 2, skill: 'grammar', track: 'B', minutes: 30, title: 'c' },
    ]),
  ]);
});

describe('learner progress', () => {
  it('summarises answers by chapter and by tag, with the 30-day window', async () => {
    await answer(learner, 'toeic-p5-001-1', 'A');
    await answer(learner, 'toeic-p5-001-2', 'C');
    await answer(learner, 'toeic-p5-001-3', 'C');
    await answer(learner, 'toeic-p6-001-1', 'D');
    const p = await progress(learner);
    expect(p.totals).toMatchObject({
      answers: 4,
      correct: 3,
      answers_30d: 4,
      correct_30d: 3,
      median_time_ms: 3000,
    });
    expect(p.by_chapter.map((c) => [c.name, c.n, c.correct])).toEqual([
      ['Part 5', 3, 2],
      ['Part 6', 1, 1],
    ]);
    expect(p.by_tag.find((x) => x.tag === 'passive')).toMatchObject({ n: 2, correct: 1 });
    expect(p.totals.due_reviews).toBe(0);
    expect(p.heatmap).toEqual([{ day: await today(), answers: 4, tasks: 0, cards: 0 }]);
  });

  it('counts tasks and their minutes', async () => {
    await t.q(learner, `insert into task_progress (course_id, task_id) values ('toeic', 'toeic-w1d1t1')`);
    const p = await progress(learner);
    expect(p.totals).toMatchObject({ tasks: 1, task_minutes: 20 });
    expect(p.heatmap.at(-1)).toMatchObject({ tasks: 1 });
  });

  it('lets only admins read another learner, and only members read their own', async () => {
    await expect(progress(other, learner)).rejects.toThrow(/admin only/);
    expect((await progress(admin, learner)).totals.answers).toBe(4);
    await expect(progress(outsider)).rejects.toThrow(/not enrolled/);
  });

  it('computes the current and longest streak from any study activity', async () => {
    await reviewDaysAgo(other, [1, 2, 6, 7, 8, 9]);
    const s = (await progress(other)).streak;
    expect(s).toMatchObject({ current_streak: 2, longest_streak: 4, active_days: 6 });
    await reviewDaysAgo(other, [3]);
    expect((await progress(other)).streak.current_streak).toBe(3);
  });
});

describe('review list', () => {
  it('lists missed questions once they are due and lets the learner dismiss them', async () => {
    const id = await qid('toeic-p5-001-2');
    const due = async () =>
      (await t.q<{ id: number }>(learner, `select ot_due_review_ids('toeic') as id`)).map((r) => r.id);
    expect(await due()).toEqual([]); // missed today, due tomorrow
    await t.db.query(
      'update ot_question_stats set next_due = vn_today() where user_id = $1 and question_id = $2',
      [learner, id],
    );
    expect(await due()).toEqual([id]);
    expect((await progress(learner)).totals.due_reviews).toBe(1);
    const [{ ok }] = await t.q<{ ok: boolean }>(learner, 'select ot_dismiss_review($1) as ok', [id]);
    expect(ok).toBe(true);
    expect(await due()).toEqual([]);
    await expect(t.q(outsider, `select ot_due_review_ids('toeic')`)).rejects.toThrow(/not enrolled/);
  });
});

describe('badges', () => {
  it('has the same badge ids in SQL and in src/content/badges.ts', () => {
    const sql = readFileSync(
      join(import.meta.dirname, '..', 'migrations', '20261128000001_learner_progress.sql'),
      'utf8',
    );
    const block = sql.slice(sql.indexOf('-- badges:start'), sql.indexOf('-- badges:end'));
    const ids = [...block.matchAll(/\('([a-z0-9-]+)',/g)].map((m) => m[1]);
    expect(ids).toEqual(BADGES.map((b) => b.id));
  });

  it('awards new badges once and reports them as new only the first time', async () => {
    const first = await achievements(learner);
    expect(first).toEqual([{ badge_id: 'first-step', is_new: true }]);
    expect(await achievements(learner)).toEqual([{ badge_id: 'first-step', is_new: false }]);
  });

  it('awards a finished roadmap week for the learner’s own track only', async () => {
    // Track A needs the "all" task (already ticked) and the A task; the B task does not count.
    await t.q(learner, `insert into task_progress (course_id, task_id) values ('toeic', 'toeic-w1d1t2')`);
    const ids = (await achievements(learner)).map((a) => a.badge_id);
    expect(ids).toContain('week-done');
  });

  it('awards streaks and score improvements', async () => {
    await reviewDaysAgo(learner, [1, 2, 3, 4, 5, 6]);
    await t.q(
      learner,
      `insert into mock_scores (course_id, total, taken_at) values ('toeic', 500, current_date - 30)`,
    );
    await t.q(
      learner,
      `insert into mock_scores (course_id, total, taken_at) values ('toeic', 560, current_date)`,
    );
    const fresh = (await achievements(learner)).filter((a) => a.is_new).map((a) => a.badge_id);
    expect(fresh.sort()).toEqual(['level-up', 'streak-7']);
  });

  it('shows streaks and badge counts on the leaderboard', async () => {
    const rows = await t.q<{ display_name: string; streak: number; badges: number }>(
      other,
      `select display_name, streak, badges from get_leaderboard('toeic')`,
    );
    expect(rows).toEqual([
      { display_name: 'Lan', streak: 7, badges: 4 },
      { display_name: 'Minh', streak: 3, badges: 0 },
    ]);
  });
});
