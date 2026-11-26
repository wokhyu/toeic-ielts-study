// @vitest-environment node
import { beforeAll, describe, expect, it } from 'vitest';
import { BANK_COURSES, loadBank } from '../../scripts/bank-content.ts';
import { createTestDb, type TestDb } from './harness.ts';

// Imports the real content/bank files through the same SQL functions the
// bank-sync workflow uses, then answers every question with its own key.
let t: TestDb;
let learner: string;

beforeAll(async () => {
  t = await createTestDb();
  const admin = await t.signUp('admin@example.com');
  learner = await t.signUp('learner@example.com');
  await t.makeAdmin(admin);
  for (const course of BANK_COURSES) {
    await t.q(admin, `select admin_set_enrollment($1, $2, 'approved')`, [learner, course]);
    const bank = loadBank(course);
    expect(bank.errors).toEqual([]);
    await t.db.query('select ot_bank_upsert_taxonomy($1, $2)', [course, JSON.stringify(bank.taxonomy)]);
    for (const { path, file } of bank.files) {
      for (const set of file.sets) {
        await t.db.query('select ot_bank_upsert_set($1, $2, $3)', [course, path, JSON.stringify(set)]);
      }
    }
  }
});

describe.each(BANK_COURSES)('%s bank content', (course) => {
  it('imports every question as ready to practise', async () => {
    const bank = loadBank(course);
    const expected = bank.files.reduce(
      (n, f) => n + f.file.sets.reduce((k, s) => k + s.questions.length, 0),
      0,
    );
    const rows = await t.q<{ n: number }>(
      learner,
      `select count(*)::int as n from ot_questions where course_id = $1 and status = 'ok'`,
      [course],
    );
    expect(rows[0].n).toBe(expected);
  });

  it('grades the key of every question as correct', async () => {
    const bank = loadBank(course);
    for (const { file } of bank.files) {
      for (const set of file.sets) {
        for (const q of set.questions) {
          const [{ id }] = (
            await t.db.query<{ id: number }>('select id from ot_questions where ext_id = $1', [q.id])
          ).rows;
          const response = Array.isArray(q.answer) ? q.answer[0] : q.answer;
          const [{ r }] = await t.q<{ r: { is_correct: boolean } }>(
            learner,
            'select ot_answer_practice($1, $2) as r',
            [id, JSON.stringify(response)],
          );
          expect(r.is_correct, q.id).toBe(true);
        }
      }
    }
  });
});
