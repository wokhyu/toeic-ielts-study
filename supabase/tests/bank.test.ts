// @vitest-environment node
import { beforeAll, describe, expect, it } from 'vitest';
import { createTestDb, type TestDb } from './harness.ts';

let t: TestDb;
let admin: string;
let learner: string;
let other: string;

const TAXONOMY = {
  sections: [
    {
      slug: 'listening',
      name: 'Listening',
      sort: 1,
      chapters: [
        { slug: 'part-3', name: 'Part 3', sort: 3, topics: [{ slug: 'p3-office', name: 'Văn phòng' }] },
      ],
    },
    {
      slug: 'reading',
      name: 'Reading',
      sort: 2,
      chapters: [
        { slug: 'part-5', name: 'Part 5', sort: 5, topics: [{ slug: 'p5-grammar', name: 'Ngữ pháp' }] },
      ],
    },
  ],
};

const mcq = (id: string, answer: string, tags: string[]) => ({
  id,
  type: 'mcq',
  stem_html: `Câu ${id}`,
  options: ['A', 'B', 'C', 'D'].map((label) => ({ label, html: `${label} của ${id}` })),
  answer,
  explain_html: `Giải thích ${id}`,
  tags,
});

const PART5 = {
  id: 'toeic-p5-001',
  section: 'reading',
  chapter: 'part-5',
  topic: 'p5-grammar',
  questions: [
    mcq('toeic-p5-001-1', 'B', ['part5', 'passive']),
    mcq('toeic-p5-001-2', 'C', ['part5', 'passive']),
    mcq('toeic-p5-001-3', 'A', ['part5', 'tense']),
  ],
};

const PART3 = {
  id: 'toeic-p3-001',
  section: 'listening',
  chapter: 'part-3',
  topic: 'p3-office',
  stimulus: {
    kind: 'audio',
    title: 'Conversation',
    audio_script: 'Man: Is the printer fixed?\nWoman: Not yet.',
  },
  questions: [mcq('toeic-p3-001-1', 'D', ['part3']), mcq('toeic-p3-001-2', 'A', ['part3'])],
};

const MOCK_SET_L = {
  id: 'toeic-mock1-l',
  section: 'listening',
  chapter: 'part-3',
  topic: 'p3-office',
  pool: 'mock',
  stimulus: { kind: 'audio', audio_script: 'Woman: The meeting moved to Friday.' },
  questions: [mcq('toeic-mock1-l-1', 'A', []), mcq('toeic-mock1-l-2', 'B', [])],
};
const MOCK_SET_R = {
  id: 'toeic-mock1-r',
  section: 'reading',
  chapter: 'part-5',
  topic: 'p5-grammar',
  pool: 'mock',
  questions: [mcq('toeic-mock1-r-1', 'C', []), mcq('toeic-mock1-r-2', 'D', [])],
};
const MOCK = {
  id: 'toeic-mock-1',
  title: 'Mini mock 1',
  minutes: 30,
  week: 4,
  sections: [
    {
      key: 'listening',
      label: 'Listening',
      scale: [
        [0, 5],
        [1, 200],
        [2, 495],
      ],
      sets: ['toeic-mock1-l'],
    },
    {
      key: 'reading',
      label: 'Reading',
      scale: [
        [0, 5],
        [1, 250],
        [2, 495],
      ],
      sets: ['toeic-mock1-r'],
    },
  ],
};

const IELTS_TAX = {
  sections: [
    {
      slug: 'listening',
      name: 'Listening',
      chapters: [{ slug: 'section-1', name: 'Section 1', topics: [{ slug: 's1-form', name: 'Điền form' }] }],
    },
  ],
};
const IELTS_MOCK_SET = {
  id: 'ielts-mock1-l',
  section: 'listening',
  chapter: 'section-1',
  topic: 's1-form',
  pool: 'mock',
  questions: [
    { id: 'ielts-mock1-l-1', type: 'short', stem_html: 'Name', answer: ['Harris'], explain_html: '' },
    {
      id: 'ielts-mock1-l-2',
      type: 'short',
      stem_html: 'Date',
      answer: ['15 May', 'May 15'],
      explain_html: '',
    },
  ],
};
const IELTS_MOCK = {
  id: 'ielts-mock-1',
  title: 'IELTS mock',
  minutes: 60,
  sections: [
    {
      key: 'listening',
      label: 'Listening',
      scale: [
        [0, 0],
        [1, 5.5],
        [2, 6.5],
      ],
      sets: ['ielts-mock1-l'],
    },
    { key: 'reading', label: 'Reading', scale: [[0, 7]], sets: [] },
  ],
};

const importAll = async () => {
  const run = (sql: string, params: unknown[]) => t.db.query(sql, params);
  await run('select ot_bank_upsert_taxonomy($1, $2)', ['toeic', JSON.stringify(TAXONOMY)]);
  for (const set of [PART5, PART3, MOCK_SET_L, MOCK_SET_R]) {
    await run('select ot_bank_upsert_set($1, $2, $3)', [
      'toeic',
      `content/bank/toeic/${set.id}.json`,
      JSON.stringify(set),
    ]);
  }
  await run('select ot_bank_upsert_mock($1, $2)', ['toeic', JSON.stringify(MOCK)]);
  await run('select ot_bank_upsert_taxonomy($1, $2)', ['ielts', JSON.stringify(IELTS_TAX)]);
  await run('select ot_bank_upsert_set($1, $2, $3)', [
    'ielts',
    'private/ielts-mock1-l.json',
    JSON.stringify(IELTS_MOCK_SET),
  ]);
  await run('select ot_bank_upsert_mock($1, $2)', ['ielts', JSON.stringify(IELTS_MOCK)]);
};

const idOf = async (ext: string) =>
  (await t.db.query<{ id: number }>('select id from ot_questions where ext_id = $1', [ext])).rows[0].id;

beforeAll(async () => {
  t = await createTestDb();
  admin = await t.signUp('admin@example.com');
  learner = await t.signUp('learner@example.com');
  other = await t.signUp('other@example.com');
  await t.makeAdmin(admin);
  await importAll();
  for (const course of ['toeic', 'ielts']) {
    await t.q(admin, `select admin_set_enrollment($1, $2, 'approved')`, [learner, course]);
  }
  await t.q(admin, `select admin_set_enrollment($1, 'on-tap-11', 'approved')`, [other]);
});

describe('content import', () => {
  it('creates questions, keys, options and shared passages', async () => {
    const { rows } = await t.db.query<{ n: number }>(
      `select count(*)::int as n from ot_questions where course_id = 'toeic'`,
    );
    expect(rows[0].n).toBe(9);
    const stim = await t.db.query<{ n: number }>(
      `select count(distinct stimulus_id)::int as n from ot_questions where set_id = 'toeic-p3-001'`,
    );
    expect(stim.rows[0].n).toBe(1);
    const opts = await t.db.query<{ n: number }>(
      `select count(*)::int as n from ot_options o join ot_questions q on q.id = o.question_id where q.ext_id = 'toeic-p5-001-1'`,
    );
    expect(opts.rows[0].n).toBe(4);
  });

  it('is idempotent: importing again changes nothing', async () => {
    await importAll();
    const { rows } = await t.db.query<{ n: number }>(
      `select count(*)::int as n from ot_questions where course_id = 'toeic'`,
    );
    expect(rows[0].n).toBe(9);
    const opts = await t.db.query<{ n: number }>(`select count(*)::int as n from ot_options`);
    expect(opts.rows[0].n).toBe(36);
  });

  it('can only be run with the service role, not by a signed-in admin', async () => {
    await expect(
      t.q(admin, 'select ot_bank_upsert_set($1, $2, $3)', ['toeic', 'x.json', JSON.stringify(PART5)]),
    ).rejects.toThrow(/permission denied/);
  });
});

describe('access per course', () => {
  it('shows learners only practice questions of their courses', async () => {
    const rows = await t.q<{ ext_id: string }>(
      learner,
      `select ext_id from ot_questions where course_id = 'toeic' order by ext_id`,
    );
    expect(rows.map((r) => r.ext_id)).toEqual([
      'toeic-p3-001-1',
      'toeic-p3-001-2',
      'toeic-p5-001-1',
      'toeic-p5-001-2',
      'toeic-p5-001-3',
    ]);
    expect(await t.q(learner, 'select * from ot_question_keys')).toHaveLength(0);
  });

  it('keeps one course away from learners of another', async () => {
    expect(await t.q(other, `select id from ot_questions where course_id = 'toeic'`)).toHaveLength(0);
    expect(await t.q(other, 'select id from ot_stimuli')).toHaveLength(0);
    await expect(t.q(other, `select * from ot_topic_tree('toeic')`)).rejects.toThrow(/not enrolled in toeic/);
    const p5 = await idOf('toeic-p5-001-1');
    await expect(t.q(other, `select ot_answer_practice($1, '"B"')`, [p5])).rejects.toThrow(/not enrolled/);
  });

  it('hides mock passages and options until the learner sits the test', async () => {
    const stimuli = await t.q<{ ext_id: string }>(learner, 'select ext_id from ot_stimuli order by ext_id');
    expect(stimuli.map((r) => r.ext_id)).toEqual(['toeic-p3-001']);
    const mockOpts = await t.q(
      learner,
      `select o.id from ot_options o where o.question_id in (select id from ot_questions where pool = 'mock')`,
    );
    expect(mockOpts).toHaveLength(0);
    const mockId = await idOf('toeic-mock1-r-1');
    await expect(t.q(learner, `select ot_answer_practice($1, '"C"')`, [mockId])).rejects.toThrow(/not found/);
  });

  it('builds the topic tree from practice questions only', async () => {
    const rows = await t.q<{ topic_slug: string; total: number }>(
      learner,
      `select topic_slug, total::int from ot_topic_tree('toeic') order by topic_slug`,
    );
    expect(rows).toEqual([
      { topic_slug: 'p3-office', total: 2 },
      { topic_slug: 'p5-grammar', total: 3 },
    ]);
  });
});

describe('tag practice', () => {
  it('serves new questions of a tag first, then the ones answered wrong', async () => {
    const first = await t.q<{ ot_tag_question_ids: number }>(
      learner,
      `select * from ot_tag_question_ids('toeic', 'passive')`,
    );
    const [q1, q2] = [await idOf('toeic-p5-001-1'), await idOf('toeic-p5-001-2')];
    expect(first.map((r) => r.ot_tag_question_ids)).toEqual([q1, q2]);

    await t.q(learner, `select ot_answer_practice($1, '"A"')`, [q1]); // wrong
    await t.q(learner, `select ot_answer_practice($1, '"C"')`, [q2]); // right
    const next = await t.q<{ ot_tag_question_ids: number }>(
      learner,
      `select * from ot_tag_question_ids('toeic', 'passive')`,
    );
    expect(next.map((r) => r.ot_tag_question_ids)).toEqual([q1, q2]);
    const wrong = await t.q<{ ot_wrong_question_ids: number }>(
      learner,
      `select * from ot_wrong_question_ids(50, 'toeic')`,
    );
    expect(wrong.map((r) => r.ot_wrong_question_ids)).toEqual([q1]);
  });

  it('refuses a custom exam that mixes courses', async () => {
    const tree = await t.db.query<{ id: number }>(`select id from ot_topics order by id`);
    await expect(
      t.q(admin, `select ot_start_exam($1, 10, 10, array['mcq'])`, [tree.rows.map((r) => r.id)]),
    ).rejects.toThrow(/one course/);
  });
});

describe('short answers', () => {
  const grade = async (key: unknown, response: string) =>
    (
      await t.db.query<{ is_correct: boolean }>('select is_correct from ot_grade($1, $2::jsonb, $3::jsonb)', [
        'short',
        JSON.stringify(key),
        JSON.stringify(response),
      ])
    ).rows[0].is_correct;

  it('accepts any of the listed answers', async () => {
    expect(await grade(['colour', 'color'], 'Color')).toBe(true);
    expect(await grade(['colour', 'color'], 'colours')).toBe(false);
  });

  it('compares numbers only when the key is a number', async () => {
    expect(await grade('15 May', '15 June')).toBe(false);
    expect(await grade('15 May', '15 may')).toBe(true);
    expect(await grade('12.5', '12,5 cm')).toBe(true);
  });
});

describe('mock tests', () => {
  let attempt: number;

  it('starts a mock with its fixed questions and only then shows them', async () => {
    const [row] = await t.q<{ id: number }>(learner, `select ot_start_mock('toeic-mock-1') as id`);
    attempt = Number(row.id);
    const ids = await t.q<{ ot_attempt_questions: number }>(
      learner,
      'select * from ot_attempt_questions($1)',
      [attempt],
    );
    expect(ids).toHaveLength(4);
    const visible = await t.q(
      learner,
      `select id from ot_questions where pool = 'mock' and course_id = 'toeic'`,
    );
    expect(visible).toHaveLength(4);
    expect(await t.q(learner, `select id from ot_stimuli where ext_id = 'toeic-mock1-l'`)).toHaveLength(1);
    const mockId = await idOf('toeic-mock1-l-1');
    await expect(t.q(learner, 'select ot_reveal($1)', [mockId])).rejects.toThrow(/exam in progress/);
  });

  it('converts each section and records the score in the chart data', async () => {
    const answers: [string, string][] = [
      ['toeic-mock1-l-1', 'A'],
      ['toeic-mock1-l-2', 'C'],
      ['toeic-mock1-r-1', 'C'],
      ['toeic-mock1-r-2', 'D'],
    ];
    for (const [ext, letter] of answers) {
      await t.q(learner, 'select ot_save_answer($1, $2, $3)', [
        attempt,
        await idOf(ext),
        JSON.stringify(letter),
      ]);
    }
    const [{ ot_submit_exam: result }] = await t.q<{ ot_submit_exam: Record<string, unknown> }>(
      learner,
      'select ot_submit_exam($1)',
      [attempt],
    );
    expect(result).toMatchObject({
      score: 300,
      max_score: 400,
      total: 695,
      sections: { listening: { raw: 1, max: 2, scaled: 200 }, reading: { raw: 2, max: 2, scaled: 495 } },
    });
    const scores = await t.q(learner, `select course_id, week, listening, reading, total from mock_scores`);
    expect(scores).toEqual([{ course_id: 'toeic', week: 4, listening: '200', reading: '495', total: '695' }]);
  });

  it('rounds the IELTS overall band the official way', async () => {
    const [row] = await t.q<{ id: number }>(learner, `select ot_start_mock('ielts-mock-1') as id`);
    const id = Number(row.id);
    await t.q(learner, 'select ot_save_answer($1, $2, $3)', [id, await idOf('ielts-mock1-l-1'), '"harris"']);
    await t.q(learner, 'select ot_save_answer($1, $2, $3)', [id, await idOf('ielts-mock1-l-2'), '"may 15"']);
    const [{ ot_submit_exam: result }] = await t.q<{ ot_submit_exam: { total: number } }>(
      learner,
      'select ot_submit_exam($1)',
      [id],
    );
    // Listening 6.5, Reading 7 -> mean 6.75 -> 7.0
    expect(Number(result.total)).toBe(7);
  });

  it('lists published mock tests only to enrolled learners', async () => {
    expect(await t.q(learner, `select id from ot_mock_tests where course_id = 'toeic'`)).toHaveLength(1);
    expect(await t.q(other, 'select id from ot_mock_tests')).toHaveLength(0);
    await expect(t.q(other, `select ot_start_mock('toeic-mock-1')`)).rejects.toThrow(/not enrolled/);
  });
});
