// @vitest-environment node
import { beforeAll, describe, expect, it } from 'vitest';
import { createTestDb, type TestDb } from './harness.ts';

let t: TestDb;
let admin: string;
let writer: string;
let classmate: string;
let outsider: string;
let submission: number;

beforeAll(async () => {
  t = await createTestDb();
  admin = await t.signUp('admin@example.com');
  writer = await t.signUp('writer@example.com', 'Lan');
  classmate = await t.signUp('classmate@example.com', 'Minh');
  outsider = await t.signUp('outsider@example.com');
  await t.makeAdmin(admin);
  for (const u of [writer, classmate]) {
    await t.q(admin, `select admin_set_enrollment($1, 'ielts', 'approved', 'B')`, [u]);
  }
  const [row] = await t.q<{ id: number }>(
    writer,
    `insert into submissions (course_id, kind, prompt_id, text, shared)
     values ('ielts', 'writing', 'w02-a', 'Some people think cities should ban cars.', true) returning id`,
  );
  submission = row.id;
});

const take = (user: string) => t.q<{ left: number }>(user, `select ai_quota_take('writing') as left`);
const status = (user: string) =>
  t.q<{ used: number; quota: number }>(user, `select * from ai_quota_status('writing')`).then((r) => r[0]);

describe('AI quota', () => {
  it('allows the daily quota, then refuses, and a refund gives one back', async () => {
    expect(await status(writer)).toEqual({ used: 0, quota: 3 });
    expect((await take(writer))[0].left).toBe(2);
    await take(writer);
    expect((await take(writer))[0].left).toBe(0);
    await expect(take(writer)).rejects.toThrow('ai quota exceeded');
    expect(await status(writer)).toEqual({ used: 3, quota: 3 });

    await t.db.query(`set role service_role`);
    await t.db.query(`select ai_quota_refund($1, 'writing')`, [writer]);
    await t.db.query(`reset role`);
    expect(await status(writer)).toEqual({ used: 2, quota: 3 });
  });

  it('follows the admin setting and does not limit admins', async () => {
    await t.q(admin, `update app_settings set value = '{"writing": 5}' where key = 'ai_daily_quota'`);
    expect(await status(classmate)).toEqual({ used: 0, quota: 5 });
    // A learner cannot change it (RLS hides the row, so nothing is updated).
    await t.q(classmate, `update app_settings set value = '{"writing": 99}' where key = 'ai_daily_quota'`);
    expect(await status(classmate)).toEqual({ used: 0, quota: 5 });
    await expect(t.q(classmate, `select * from app_settings`)).resolves.toEqual([]);

    await t.q(admin, `update app_settings set value = '{"writing": 1}' where key = 'ai_daily_quota'`);
    await take(admin);
    await expect(take(admin)).resolves.toBeDefined();
  });

  it('needs an approved IELTS enrollment', async () => {
    await expect(take(outsider)).rejects.toThrow('not enrolled');
  });

  it('cannot be refunded or written directly by learners', async () => {
    await expect(t.q(writer, `select ai_quota_refund($1, 'writing')`, [writer])).rejects.toThrow(
      /permission denied/,
    );
    await expect(
      t.q(writer, `insert into ai_usage (user_id, day, kind, used) values ($1, current_date, 'writing', 0)`, [
        writer,
      ]),
    ).rejects.toThrow(/permission denied/);
    await expect(t.q(writer, `update ai_usage set used = 0`)).rejects.toThrow(/permission denied/);
  });
});

describe('AI feedback', () => {
  it('is saved by the service role and private to the writer and admins', async () => {
    const feedback = { criteria: [], overall: 6.5, strengths_vi: ['Rõ ý'] };
    await t.db.query(
      `insert into ai_feedback (submission_id, user_id, model, overall, feedback) values ($1, $2, 'test-model', 6.5, $3)`,
      [submission, writer, JSON.stringify(feedback)],
    );
    expect(await t.q(writer, `select overall from ai_feedback`)).toEqual([{ overall: '6.5' }]);
    expect(await t.q(admin, `select overall from ai_feedback`)).toHaveLength(1);
    // The submission is shared, but AI feedback is not.
    expect(await t.q(classmate, `select overall from ai_feedback`)).toEqual([]);

    await expect(
      t.q(
        writer,
        `insert into ai_feedback (submission_id, user_id, model, overall, feedback) values ($1, $2, 'x', 9, '{}')`,
        [submission, writer],
      ),
    ).rejects.toThrow(/permission denied/);
  });

  it('keeps one feedback per submission with a half-band overall', async () => {
    await expect(
      t.db.query(
        `insert into ai_feedback (submission_id, user_id, model, overall, feedback) values ($1, $2, 'x', 7, '{}')`,
        [submission, writer],
      ),
    ).rejects.toThrow(/duplicate key/);
    const [row] = await t.q<{ id: number }>(
      writer,
      `insert into submissions (course_id, kind, prompt_id, text) values ('ielts', 'writing', 'w03-a', 'x') returning id`,
    );
    await expect(
      t.db.query(
        `insert into ai_feedback (submission_id, user_id, model, overall, feedback) values ($1, $2, 'x', 6.3, '{}')`,
        [row.id, writer],
      ),
    ).rejects.toThrow(/check constraint/);
  });
});
