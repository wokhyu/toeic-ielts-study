// @vitest-environment node
import { beforeAll, describe, expect, it } from 'vitest';
import { createTestDb, type TestDb } from './harness.ts';

let t: TestDb;
let admin: string;
let writer: string;
let reviewer: string;
let outsider: string;

const task = (id: string, kind: string) => ({
  id,
  week: 2,
  day: 2,
  skill: 'writing',
  track: 'all',
  minutes: 30,
  title: id,
  group_activity: false,
  practice: { kind },
});

const ticked = (user: string, taskId: string) =>
  t.db
    .query<{ source: string }>('select source from task_progress where user_id = $1 and task_id = $2', [
      user,
      taskId,
    ])
    .then((r) => r.rows[0]?.source ?? null);

const write = async (user: string, text: string, extra: Record<string, unknown> = {}) => {
  const cols = ['course_id', 'kind', 'prompt_id', 'text', ...Object.keys(extra)];
  const values = ['ielts', 'writing', 'w02-a', text, ...Object.values(extra)];
  const [row] = await t.q<{ id: number; word_count: number }>(
    user,
    `insert into submissions (${cols.join(', ')}) values (${cols.map((_, i) => `$${i + 1}`).join(', ')})
     returning id, word_count`,
    values,
  );
  return row;
};

const review = (user: string, submission: number, scores: Record<string, number>, extra = '') =>
  t.q<{ overall: string }>(
    user,
    `insert into peer_reviews (submission_id, scores, comment${extra ? ', task_id' : ''})
     values ($1, $2, 'Bố cục rõ, cần thêm ví dụ cụ thể.'${extra ? ', $3' : ''}) returning overall`,
    extra ? [submission, JSON.stringify(scores), extra] : [submission, JSON.stringify(scores)],
  );

beforeAll(async () => {
  t = await createTestDb();
  admin = await t.signUp('admin@example.com');
  writer = await t.signUp('writer@example.com', 'Lan');
  reviewer = await t.signUp('reviewer@example.com', 'Minh');
  outsider = await t.signUp('outsider@example.com');
  await t.makeAdmin(admin);
  for (const u of [writer, reviewer]) {
    await t.q(admin, `select admin_set_enrollment($1, 'ielts', 'approved', 'B')`, [u]);
  }
  await t.db.query('select content_upsert_roadmap_tasks($1, $2)', [
    'ielts',
    JSON.stringify([
      task('ielts-w2d2t3', 'writing'),
      task('ielts-w2d2t6', 'speaking'),
      task('ielts-w2d4t2', 'review'),
    ]),
  ]);
});

describe('writing and speaking submissions', () => {
  it('counts words on the server and ticks the writing task', async () => {
    const row = await write(writer, '  Cities  grow\nfast, and roads\tdo not. ', {
      word_count: 999,
      task_id: 'ielts-w2d2t3',
    });
    expect(row.word_count).toBe(7);
    expect(await ticked(writer, 'ielts-w2d2t3')).toBe('auto');
    await expect(write(outsider, 'Not enrolled.')).rejects.toThrow(/row-level security/);
  });

  it('keeps work private until the owner shares it', async () => {
    const { id } = await write(writer, 'A private draft about public transport.');
    const sees = async (user: string) =>
      (await t.q<{ id: number }>(user, 'select id from submissions where id = $1', [id])).length === 1;
    expect(await sees(reviewer)).toBe(false);
    expect(await sees(admin)).toBe(true);

    await t.q(writer, 'update submissions set shared = true where id = $1', [id]);
    expect(await sees(reviewer)).toBe(true);
    expect(await sees(outsider)).toBe(false);

    // The text is final once submitted; only sharing and recordings can change.
    await expect(t.q(writer, `update submissions set text = 'edited' where id = $1`, [id])).rejects.toThrow(
      /permission denied/,
    );
    await expect(
      t.q(reviewer, 'update submissions set shared = false where id = $1 returning id', [id]),
    ).resolves.toEqual([]);
  });

  it('lets classmates review shared work once, never their own, and rounds the overall band', async () => {
    const { id } = await write(writer, 'Some people believe that roads matter more than buses.');
    await expect(review(reviewer, id, { TR: 6, CC: 6, LR: 6, GRA: 6 })).rejects.toThrow(/row-level security/);
    await t.q(writer, 'update submissions set shared = true where id = $1', [id]);

    await expect(review(writer, id, { TR: 6, CC: 6, LR: 6, GRA: 6 })).rejects.toThrow(/row-level security/);
    await expect(review(reviewer, id, { TR: 6, CC: 6, LR: 6 })).rejects.toThrow(/four writing criteria/);
    await expect(review(reviewer, id, { TR: 6, CC: 6, LR: 6, GRA: 6.3 })).rejects.toThrow(/half bands/);
    await expect(review(reviewer, id, { FC: 6, CC: 6, LR: 6, GRA: 6 })).rejects.toThrow(/criteria/);

    const [{ overall }] = await review(reviewer, id, { TR: 6, CC: 5.5, LR: 6, GRA: 5 }, 'ielts-w2d4t2');
    expect(Number(overall)).toBe(5.5); // mean 5.625
    expect(await ticked(reviewer, 'ielts-w2d4t2')).toBe('auto');
    await expect(review(reviewer, id, { TR: 7, CC: 7, LR: 7, GRA: 7 })).rejects.toThrow(/duplicate key/);

    const others = await t.q<{ id: number; author: string; reviews: number; reviewed_by_me: boolean }>(
      reviewer,
      `select id, author, reviews, reviewed_by_me from submission_list('ielts', 'others') where id = $1`,
      [id],
    );
    expect(others).toEqual([{ id, author: 'Lan', reviews: 1, reviewed_by_me: true }]);
    const reviews = await t.q<{ reviewer: string; overall: string }>(
      writer,
      'select * from submission_reviews($1)',
      [id],
    );
    expect(reviews.map((r) => [r.reviewer, Number(r.overall)])).toEqual([['Minh', 5.5]]);
    expect(await t.q(outsider, 'select * from submission_reviews($1)', [id])).toEqual([]);
  });

  it('stores recordings in the owner folder and shares them with the submission', async () => {
    const [{ id }] = await t.q<{ id: number }>(
      writer,
      `insert into submissions (course_id, kind, prompt_id, task_id) values ('ielts', 'speaking', 's02', 'ielts-w2d2t6')
       returning id`,
    );
    expect(await ticked(writer, 'ielts-w2d2t6')).toBeNull(); // nothing recorded yet

    const path = `${writer}/${id}/1.webm`;
    await t.q(writer, `insert into storage.objects (bucket_id, name) values ('speaking', $1)`, [path]);
    await expect(
      t.q(writer, `insert into storage.objects (bucket_id, name) values ('speaking', $1)`, [
        `${reviewer}/${id}/1.webm`,
      ]),
    ).rejects.toThrow(/row-level security/);
    await expect(
      t.q(writer, 'update submissions set audio = $2 where id = $1', [
        id,
        JSON.stringify([{ part: 1, question: 'Q', path: `${writer}/999/1.webm`, seconds: 20 }]),
      ]),
    ).rejects.toThrow(/audio paths/);

    await t.q(writer, 'update submissions set audio = $2, seconds = 20 where id = $1', [
      id,
      JSON.stringify([{ part: 1, question: 'Q', path, seconds: 20 }]),
    ]);
    expect(await ticked(writer, 'ielts-w2d2t6')).toBe('auto');

    const visible = async (user: string) =>
      (await t.q(user, `select name from storage.objects where bucket_id = 'speaking' and name = $1`, [path]))
        .length;
    expect(await visible(writer)).toBe(1);
    expect(await visible(reviewer)).toBe(0);
    await t.q(writer, 'update submissions set shared = true where id = $1', [id]);
    expect(await visible(reviewer)).toBe(1);
    expect(await visible(outsider)).toBe(0);
    expect(await visible(admin)).toBe(1);

    await expect(review(reviewer, id, { FC: 6, LR: 6, GRA: 5.5, P: 6.5 })).resolves.toHaveLength(1);
  });
});
