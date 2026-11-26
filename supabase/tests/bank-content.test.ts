// @vitest-environment node
import { beforeAll, describe, expect, it } from 'vitest';
import { BANK_COURSES, loadBank, type BankCourse } from '../../scripts/bank-content.ts';
import { createTestDb, type TestDb } from './harness.ts';

// Imports the real content/bank files through the same SQL functions the
// bank-sync workflow uses, then checks that every key grades as correct.
// Mock sets (content-private/, only on a maintainer's machine) are imported too;
// they stay hidden from practice, so learner-facing checks use practice sets only.
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
    for (const { mock } of bank.mocks) {
      await t.db.query('select ot_bank_upsert_mock($1, $2)', [course, JSON.stringify(mock)]);
    }
  }
});

const allSets = (course: BankCourse) => loadBank(course).files.flatMap((f) => f.file.sets);
const practiceSets = (course: BankCourse) => allSets(course).filter((s) => s.pool === 'practice');

describe.each(BANK_COURSES)('%s bank content', (course) => {
  it('shows every practice question to an enrolled learner', async () => {
    const expected = practiceSets(course).reduce((n, s) => n + s.questions.length, 0);
    const rows = await t.q<{ n: number }>(
      learner,
      `select count(*)::int as n from ot_questions where course_id = $1 and status = 'ok'`,
      [course],
    );
    expect(rows[0].n).toBe(expected);
  });

  it('grades every accepted answer of every question as correct', async () => {
    for (const set of allSets(course)) {
      for (const q of set.questions) {
        const [{ key }] = (
          await t.db.query<{ key: unknown }>(
            `select k.answer_key as key from ot_questions q join ot_question_keys k on k.question_id = q.id
              where q.ext_id = $1`,
            [q.id],
          )
        ).rows;
        for (const response of Array.isArray(q.answer) ? q.answer : [q.answer]) {
          const [{ ok }] = (
            await t.db.query<{ ok: boolean }>('select (ot_grade($1, $2, $3)).is_correct as ok', [
              q.type,
              JSON.stringify(key),
              JSON.stringify(response),
            ])
          ).rows;
          expect(ok, `${q.id}: ${response}`).toBe(true);
        }
      }
    }
  });

  it('accepts a practice answer through the learner API', async () => {
    const q = practiceSets(course)[0].questions[0];
    const [{ id }] = (
      await t.db.query<{ id: number }>('select id from ot_questions where ext_id = $1', [q.id])
    ).rows;
    const response = Array.isArray(q.answer) ? q.answer[0] : q.answer;
    const [{ r }] = await t.q<{ r: { is_correct: boolean } }>(
      learner,
      'select ot_answer_practice($1, $2) as r',
      [id, JSON.stringify(response)],
    );
    expect(r.is_correct).toBe(true);
  });
});
