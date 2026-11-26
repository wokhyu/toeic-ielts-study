import { describe, expect, it } from 'vitest';
import { checkBank, countByTag } from './bank-check.ts';
import { bankFileSchema, bankTaxonomySchema, type BankFile } from './bank-schema.ts';

const taxonomy = bankTaxonomySchema.parse({
  sections: [{ slug: 'reading', name: 'Reading', chapters: [{ slug: 'part-5', name: 'Part 5', topics: [{ slug: 'grammar', name: 'G' }] }] }],
  tags: { passive: 'Câu bị động' },
});

const file = (sets: unknown[]): BankFile => bankFileSchema.parse({ sets });

const mcq = (id: string, answer = 'A', tags = ['passive']) => ({
  id,
  type: 'mcq',
  stem_html: `The report ------- by Friday (${id}).`,
  options: [
    { label: 'A', html: 'is sent' },
    { label: 'B', html: 'sends' },
  ],
  answer,
  explain_html: 'Bị động.',
  tags,
});

const set = (id: string, questions: unknown[], extra: object = {}) => ({
  id,
  section: 'reading',
  chapter: 'part-5',
  topic: 'grammar',
  questions,
  ...extra,
});

describe('checkBank', () => {
  it('accepts consistent content', () => {
    const f = file([set('toeic-p5-001', [mcq('toeic-p5-001-1'), mcq('toeic-p5-001-2', 'B')])]);
    expect(checkBank('toeic', taxonomy, [{ path: 'content/bank/toeic/part5.json', file: f }])).toEqual([]);
    expect(countByTag([{ file: f }]).get('passive')).toBe(2);
  });

  it('reports wrong answers, unknown tags and topics, ids and duplicates', () => {
    const f = file([
      set('toeic-p5-001', [mcq('toeic-p5-001-1', 'C'), mcq('toeic-p5-002-1', 'A', ['nope'])]),
      set('toeic-p5-001', [mcq('toeic-p5-001-1')], { topic: 'missing' }),
    ]);
    const errors = checkBank('toeic', taxonomy, [{ path: 'p.json', file: f }]).join('\n');
    expect(errors).toMatch(/answer "C" is not an option/);
    expect(errors).toMatch(/unknown tag "nope"/);
    expect(errors).toMatch(/must start with its set id/);
    expect(errors).toMatch(/duplicate id/);
    expect(errors).toMatch(/unknown topic/);
    expect(errors).toMatch(/same stem/);
  });

  it('keeps mock sets out of the public repo and checks mock scales', () => {
    const mockSet = file([set('toeic-mock1-r', [mcq('toeic-mock1-r-1')], { pool: 'mock' })]);
    expect(checkBank('toeic', taxonomy, [{ path: 'content/bank/toeic/x.json', file: mockSet }]).join()).toMatch(
      /content-private/,
    );
    const errors = checkBank(
      'toeic',
      taxonomy,
      [{ path: 'content-private/bank/toeic/m.json', file: mockSet }],
      [
        {
          path: 'content-private/mocks/m.json',
          mock: {
            id: 'toeic-mock-1',
            title: 'Mock',
            minutes: 30,
            sections: [
              { key: 'reading', label: 'Reading', scale: [[1, 5], [0, 5]], sets: ['toeic-mock1-r', 'toeic-unknown'] },
            ],
          },
        },
      ],
    ).join('\n');
    expect(errors).toMatch(/sorted by raw/);
    expect(errors).toMatch(/start at raw 0/);
    expect(errors).toMatch(/unknown set toeic-unknown/);
  });

  it('requires a script for recordings', () => {
    const f = file([set('toeic-p3-001', [mcq('toeic-p3-001-1')], { stimulus: { kind: 'audio' } })]);
    expect(checkBank('toeic', taxonomy, [{ path: 'p.json', file: f }]).join()).toMatch(/audio_script/);
  });
});
