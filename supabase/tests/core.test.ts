// @vitest-environment node
import { beforeAll, describe, expect, it } from 'vitest';
import { createTestDb, type TestDb } from './harness.ts';

let t: TestDb;
let admin: string;
let alice: string;
let bob: string;

beforeAll(async () => {
  t = await createTestDb();
  admin = await t.signUp('admin@example.com', 'Admin');
  alice = await t.signUp('alice@example.com', 'Alice');
  bob = await t.signUp('bob@example.com');
  await t.makeAdmin(admin);
});

describe('profiles', () => {
  it('creates a learner profile on sign-up, defaulting the name to the e-mail prefix', async () => {
    const rows = await t.q<{ display_name: string; role: string }>(
      bob,
      'select display_name, role from profiles',
    );
    expect(rows).toEqual([{ display_name: 'bob', role: 'learner' }]);
  });

  it('lets a learner see only their own profile', async () => {
    const rows = await t.q(alice, 'select id from profiles');
    expect(rows).toEqual([{ id: alice }]);
  });

  it('lets an admin see every profile', async () => {
    const rows = await t.q(admin, 'select id from profiles');
    expect(rows).toHaveLength(3);
  });

  it('lets a learner rename themselves but not change their role', async () => {
    await t.q(alice, `update profiles set display_name = 'Alice N.' where id = $1`, [alice]);
    await expect(t.q(alice, `update profiles set role = 'admin' where id = $1`, [alice])).rejects.toThrow(
      /permission denied/,
    );
    const [row] = await t.q<{ display_name: string; role: string }>(
      admin,
      'select display_name, role from profiles where id = $1',
      [alice],
    );
    expect(row).toEqual({ display_name: 'Alice N.', role: 'learner' });
  });

  it('blocks learners from admin functions', async () => {
    await expect(t.q(alice, 'select * from admin_list_users()')).rejects.toThrow(/admin only/);
    await expect(t.q(alice, `select admin_set_role($1, 'admin')`, [alice])).rejects.toThrow(/admin only/);
  });

  it('stops an admin from removing their own admin role', async () => {
    await expect(t.q(admin, `select admin_set_role($1, 'learner')`, [admin])).rejects.toThrow(
      /own admin role/,
    );
  });

  it('lists users with e-mail for admins', async () => {
    const rows = await t.q<{ email: string }>(admin, 'select email from admin_list_users()');
    expect(rows.map((r) => r.email).sort()).toEqual([
      'admin@example.com',
      'alice@example.com',
      'bob@example.com',
    ]);
  });
});

describe('enrollments', () => {
  it('creates a pending request', async () => {
    const [row] = await t.q<{ request_enrollment: string }>(alice, `select request_enrollment('toeic')`);
    expect(row.request_enrollment).toBe('pending');
  });

  it('does not let learners approve themselves', async () => {
    await expect(
      t.q(alice, `update enrollments set status = 'approved' where user_id = $1`, [alice]),
    ).rejects.toThrow(/permission denied/);
    await expect(
      t.q(alice, `insert into enrollments (user_id, course_id, status) values ($1, 'ielts', 'approved')`, [
        alice,
      ]),
    ).rejects.toThrow(/permission denied/);
    await expect(t.q(alice, `select admin_set_enrollment($1, 'toeic', 'approved')`, [alice])).rejects.toThrow(
      /admin only/,
    );
  });

  it('keeps course content closed until the request is approved', async () => {
    await expect(
      t.q(alice, `insert into task_progress (course_id, task_id) values ('toeic', 'toeic-w1d1t1')`),
    ).rejects.toThrow(/row-level security/);
  });

  it('opens the course after admin approval', async () => {
    await t.q(admin, `select admin_set_enrollment($1, 'toeic', 'approved', 'B', '2026-11-16')`, [alice]);
    await t.q(alice, `insert into task_progress (course_id, task_id) values ('toeic', 'toeic-w1d1t1')`);
    const rows = await t.q(alice, 'select task_id from task_progress');
    expect(rows).toEqual([{ task_id: 'toeic-w1d1t1' }]);
  });

  it('rejects a task id from another course', async () => {
    await expect(
      t.q(alice, `insert into task_progress (course_id, task_id) values ('toeic', 'ielts-w1d1t1')`),
    ).rejects.toThrow(/check constraint/);
  });

  it('lets an approved learner change only track and start date', async () => {
    await t.q(alice, `update enrollments set track = 'C' where user_id = $1 and course_id = 'toeic'`, [
      alice,
    ]);
    const [row] = await t.q<{ track: string; status: string }>(
      alice,
      `select track, status from enrollments where course_id = 'toeic'`,
    );
    expect(row).toEqual({ track: 'C', status: 'approved' });
  });

  it('closes the course again when access is revoked, and lets the learner ask again', async () => {
    await t.q(admin, `select admin_set_enrollment($1, 'toeic', 'revoked')`, [alice]);
    await expect(
      t.q(alice, `insert into task_progress (course_id, task_id) values ('toeic', 'toeic-w1d1t2')`),
    ).rejects.toThrow(/row-level security/);
    const [row] = await t.q<{ request_enrollment: string }>(alice, `select request_enrollment('toeic')`);
    expect(row.request_enrollment).toBe('pending');
    await t.q(admin, `select admin_set_enrollment($1, 'toeic', 'approved')`, [alice]);
  });

  it('lets an admin read any learner progress, and hides it from other learners', async () => {
    expect(await t.q(admin, 'select task_id from task_progress where user_id = $1', [alice])).toHaveLength(1);
    expect(await t.q(bob, 'select task_id from task_progress')).toHaveLength(0);
  });
});

describe('leaderboard', () => {
  it('is only available to members of the course', async () => {
    await expect(t.q(bob, `select * from get_leaderboard('toeic')`)).rejects.toThrow(/not enrolled/);
  });

  it('counts tasks and the current streak', async () => {
    await t.q(admin, `select admin_set_enrollment($1, 'toeic', 'approved', 'A')`, [bob]);
    // Bob studied today, yesterday and the day before, then had a gap before that.
    await t.db.query(
      `insert into task_progress (user_id, course_id, task_id, completed_at) values
         ($1, 'toeic', 'toeic-w1d1t1', now()),
         ($1, 'toeic', 'toeic-w1d1t2', now() - interval '1 day'),
         ($1, 'toeic', 'toeic-w1d1t3', now() - interval '2 days'),
         ($1, 'toeic', 'toeic-w1d1t4', now() - interval '5 days')`,
      [bob],
    );
    const rows = await t.q<{ display_name: string; tasks_done: number; streak: number; active_days: number }>(
      alice,
      `select display_name, tasks_done::int, streak, active_days::int from get_leaderboard('toeic')`,
    );
    expect(rows[0]).toEqual({ display_name: 'bob', tasks_done: 4, streak: 3, active_days: 4 });
    expect(rows[1]).toMatchObject({ display_name: 'Alice N.', tasks_done: 1, streak: 1 });
  });
});
