// @vitest-environment node
import { beforeAll, describe, expect, it } from 'vitest';
import { createTestDb, type TestDb } from './harness.ts';

let t: TestDb;
let admin: string;
let learner: string;
let outsider: string;

const SEED = `
  insert into ot_subjects (id, slug, name, sort) values (1, 'toan', 'Toán', 1);
  insert into ot_chapters (id, subject_id, slug, name, sort) values (1, 1, 'luong-giac', 'Lượng giác', 1);
  insert into ot_topics (id, chapter_id, slug, name, sort) values (1, 1, 'ptlg', 'Phương trình lượng giác', 1);
  insert into ot_sources (id, path, subject_id, title) values (1, 'toan/a.docx', 1, 'Đề A');
  insert into ot_questions (id, topic_id, source_id, number_in_source, type, stem_html, status, content_hash) values
    (1, 1, 1, 1, 'mcq', 'Câu 1', 'ok', 'h1'),
    (2, 1, 1, 2, 'mcq', 'Câu 2', 'ok', 'h2'),
    (3, 1, 1, 3, 'truefalse', 'Câu 3', 'ok', 'h3'),
    (4, 1, 1, 4, 'mcq', 'Câu 4 chưa có đáp án', 'needs_review', 'h4');
  insert into ot_question_keys (question_id, answer_key, answer_source, solution_html) values
    (1, '"B"', 'grid', 'Lời giải 1'),
    (2, '"C"', 'grid', 'Lời giải 2'),
    (3, '{"a":true,"b":true,"c":false,"d":false}', 'table', 'Lời giải 3'),
    (4, null, null, '');
  insert into ot_options (id, question_id, label, html, sort) values
    (1, 1, 'A', 'x', 0), (2, 1, 'B', 'y', 1), (3, 2, 'A', 'x', 0), (4, 2, 'C', 'z', 1);
`;

beforeAll(async () => {
  t = await createTestDb();
  admin = await t.signUp('admin@example.com');
  learner = await t.signUp('learner@example.com');
  outsider = await t.signUp('outsider@example.com');
  await t.makeAdmin(admin);
  await t.db.exec(SEED);
  await t.q(admin, `select admin_set_enrollment($1, 'on-tap-11', 'approved')`, [learner]);
});

const grade = async (type: string, key: unknown, response: unknown) => {
  const { rows } = await t.db.query<{ score: number | null; is_correct: boolean | null }>(
    'select * from ot_grade($1, $2::jsonb, $3::jsonb)',
    [type, JSON.stringify(key), JSON.stringify(response)],
  );
  return rows[0];
};

describe('ot_grade (same cases as the original grade.test.ts)', () => {
  it('grades multiple choice regardless of case or padding', async () => {
    expect((await grade('mcq', 'B', ' b ')).is_correct).toBe(true);
    expect(await grade('mcq', 'B', 'C')).toEqual({ score: 0, is_correct: false });
    expect((await grade('mcq', 'B', '')).is_correct).toBe(false);
  });

  it('follows the official Dung/Sai partial-credit ladder', async () => {
    const key = { a: true, b: true, c: false, d: false };
    expect((await grade('truefalse', key, {})).score).toBe(0);
    expect((await grade('truefalse', key, { a: true })).score).toBe(10);
    expect((await grade('truefalse', key, { a: true, b: true })).score).toBe(25);
    expect((await grade('truefalse', key, { a: true, b: true, c: false })).score).toBe(50);
    expect(await grade('truefalse', key, key)).toEqual({ score: 100, is_correct: true });
    expect(await grade('truefalse', key, { a: true, b: false, c: false, d: true })).toEqual({
      score: 25,
      is_correct: false,
    });
    expect((await grade('truefalse', { a: true, b: false }, { a: true })).score).toBe(50);
  });

  it('compares short answers as numbers when possible', async () => {
    expect((await grade('short', '12.5', '12,5 cm')).is_correct).toBe(true);
    expect((await grade('short', '0.25', '1/4')).is_correct).toBe(true);
    expect((await grade('short', '3.333333', '3.3333331')).is_correct).toBe(true);
    expect((await grade('short', '3.33', '3.34')).is_correct).toBe(false);
  });

  it('falls back to a case-insensitive text comparison', async () => {
    expect((await grade('short', 'abc', 'ABC')).is_correct).toBe(true);
    expect((await grade('short', 'abc', 'abd')).is_correct).toBe(false);
    expect((await grade('short', '5', '')).is_correct).toBe(false);
  });

  it('leaves essays and missing keys ungraded', async () => {
    expect(await grade('essay', null, 'gì đó')).toEqual({ score: null, is_correct: null });
    expect((await grade('mcq', null, 'A')).is_correct).toBeNull();
  });
});

describe('access', () => {
  it('hides the question bank from learners who are not enrolled', async () => {
    expect(await t.q(outsider, 'select id from ot_questions')).toHaveLength(0);
    await expect(t.q(outsider, 'select * from ot_topic_tree()')).rejects.toThrow(/not enrolled/);
    await expect(t.q(outsider, `select ot_answer_practice(1, '"B"')`)).rejects.toThrow(/not enrolled/);
  });

  it('shows enrolled learners only ready questions and never the answer keys', async () => {
    const ids = await t.q<{ id: number }>(learner, 'select id from ot_questions order by id');
    expect(ids.map((r) => r.id)).toEqual([1, 2, 3]);
    expect(await t.q(learner, 'select * from ot_question_keys')).toHaveLength(0);
  });

  it('lets an admin see questions waiting for review and their keys', async () => {
    expect(await t.q(admin, `select id from ot_questions where status = 'needs_review'`)).toHaveLength(1);
    expect(await t.q(admin, 'select * from ot_question_keys')).toHaveLength(4);
  });

  it('builds the topic tree with progress', async () => {
    const [row] = await t.q<{ topic_name: string; total: number }>(
      learner,
      'select topic_name, total::int from ot_topic_tree()',
    );
    expect(row).toEqual({ topic_name: 'Phương trình lượng giác', total: 3 });
  });
});

describe('practice', () => {
  it('grades an answer, reveals the solution and records the attempt', async () => {
    const [{ ot_answer_practice: r }] = await t.q<{ ot_answer_practice: Record<string, unknown> }>(
      learner,
      `select ot_answer_practice(1, '"A"')`,
    );
    expect(r).toMatchObject({ is_correct: false, score: 0, answer_key: 'B', solution_html: 'Lời giải 1' });
    const stats = await t.q(learner, 'select question_id, seen, correct from ot_question_stats');
    expect(stats).toEqual([{ question_id: 1, seen: 1, correct: 0 }]);
  });

  it('lists wrong answers and serves unseen questions first', async () => {
    const wrong = await t.q<{ ot_wrong_question_ids: number }>(
      learner,
      'select * from ot_wrong_question_ids()',
    );
    expect(wrong.map((r) => r.ot_wrong_question_ids)).toEqual([1]);
    const next = await t.q<{ ot_topic_question_ids: number }>(
      learner,
      'select * from ot_topic_question_ids(1)',
    );
    expect(next.map((r) => r.ot_topic_question_ids)).toEqual([2, 3, 1]);
  });

  it('only reveals keys for questions the learner has answered', async () => {
    await expect(t.q(learner, 'select ot_reveal(2)')).rejects.toThrow(/answer the question first/);
    const [{ ot_reveal: r }] = await t.q<{ ot_reveal: Record<string, unknown> }>(
      learner,
      'select ot_reveal(1)',
    );
    expect(r).toEqual({ answer_key: 'B', solution_html: 'Lời giải 1' });
  });

  it('toggles bookmarks', async () => {
    expect((await t.q(learner, 'select ot_toggle_bookmark(2) as on'))[0]).toEqual({ on: true });
    expect((await t.q(learner, 'select ot_toggle_bookmark(2) as on'))[0]).toEqual({ on: false });
  });
});

describe('exam', () => {
  let attempt: number;

  it('starts an exam from the selected topics, ignoring questions without answers', async () => {
    const [row] = await t.q<{ id: number }>(
      learner,
      `select ot_start_exam(array[1], 10, 30, array['mcq']) as id`,
    );
    attempt = Number(row.id);
    const qs = await t.q<{ ot_attempt_questions: number }>(
      learner,
      'select * from ot_attempt_questions($1)',
      [attempt],
    );
    expect(qs.map((r) => r.ot_attempt_questions).sort()).toEqual([1, 2]);
  });

  it('keeps keys hidden while the exam is open', async () => {
    await expect(t.q(learner, `select ot_answer_practice(2, '"C"')`)).rejects.toThrow(/exam in progress/);
    await expect(t.q(learner, 'select ot_reveal(1)')).rejects.toThrow(/exam in progress/);
    await expect(t.q(learner, 'select * from ot_attempt_review($1)', [attempt])).rejects.toThrow(
      /not submitted/,
    );
  });

  it('does not let another learner write into the attempt', async () => {
    await t.q(admin, `select admin_set_enrollment($1, 'on-tap-11', 'approved')`, [outsider]);
    const [row] = await t.q<{ ok: boolean }>(outsider, `select ot_save_answer($1, 1, '"B"') as ok`, [
      attempt,
    ]);
    expect(row.ok).toBe(false);
  });

  it('saves answers, grades on submit and then shows the review', async () => {
    await t.q(learner, `select ot_save_answer($1, 1, '"B"')`, [attempt]);
    await t.q(learner, `select ot_save_answer($1, 2, '"A"')`, [attempt]);
    const [{ ot_submit_exam: result }] = await t.q<{ ot_submit_exam: Record<string, number> }>(
      learner,
      'select ot_submit_exam($1)',
      [attempt],
    );
    expect(result).toEqual({ score: 100, max_score: 200 });
    const review = await t.q<{ question_id: number; is_correct: boolean; answer_key: string }>(
      learner,
      'select question_id, is_correct, answer_key from ot_attempt_review($1) order by question_id',
      [attempt],
    );
    expect(review).toEqual([
      { question_id: 1, is_correct: true, answer_key: 'B' },
      { question_id: 2, is_correct: false, answer_key: 'C' },
    ]);
    const [late] = await t.q<{ ok: boolean }>(learner, `select ot_save_answer($1, 2, '"C"') as ok`, [
      attempt,
    ]);
    expect(late.ok).toBe(false);
  });
});

describe('admin review', () => {
  it('lets only admins set an answer key, which publishes the question', async () => {
    await expect(t.q(learner, `select ot_admin_set_key(4, '"D"', 'ok')`)).rejects.toThrow(/admin only/);
    await t.q(admin, `select ot_admin_set_key(4, '"D"', 'ok')`);
    const ids = await t.q<{ id: number }>(learner, 'select id from ot_questions order by id');
    expect(ids.map((r) => r.id)).toEqual([1, 2, 3, 4]);
  });

  it('keeps a non-essay question in review when saved without a key, but can open an essay', async () => {
    await t.db.exec(`insert into ot_questions (id, topic_id, source_id, type, stem_html, status, content_hash)
                     values (5, 1, 1, 'essay', 'Tự luận', 'needs_review', 'h5'), (6, 1, 1, 'mcq', 'Câu 6', 'needs_review', 'h6')`);
    await t.q(admin, `select ot_admin_set_key(5, null, 'ok')`);
    await t.q(admin, `select ot_admin_set_key(6, null, 'ok')`);
    const rows = await t.q<{ id: number; status: string }>(
      admin,
      'select id, status from ot_questions where id in (5, 6) order by id',
    );
    expect(rows).toEqual([
      { id: 5, status: 'ok' },
      { id: 6, status: 'needs_review' },
    ]);
  });
});
