import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { z } from 'zod';
import {
  ieltsSkills,
  placementTestSchema,
  productiveTestSchema,
  scoringSchema,
  speakingSetsSchema,
  toeicSkills,
  vocabDeckSchema,
  weekSchema,
  writingPromptsSchema,
  type Week,
} from '../src/content/schema.ts';
import { BANK_COURSES, loadBank } from './bank-content.ts';

const root = join(process.cwd(), 'content');
const errors: string[] = [];

function load<T>(rel: string, schema: z.ZodType<T>): T | undefined {
  const raw: unknown = JSON.parse(readFileSync(join(root, rel), 'utf8'));
  const result = schema.safeParse(raw);
  if (!result.success) {
    for (const issue of result.error.issues) {
      errors.push(`${rel}: ${issue.path.join('.')}: ${issue.message}`);
    }
    return undefined;
  }
  return result.data;
}

function checkUnique(label: string, ids: string[]) {
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) errors.push(`${label}: duplicate id "${id}"`);
    seen.add(id);
  }
}

// Placement tests
const toeicTest = load('placement/toeic.json', placementTestSchema);
const ieltsTest = load('placement/ielts.json', placementTestSchema);
load('placement/ielts-productive.json', productiveTestSchema);
const scoring = load('placement/scoring.json', scoringSchema);

for (const [label, test, program] of [
  ['placement/toeic.json', toeicTest, 'toeic'],
  ['placement/ielts.json', ieltsTest, 'ielts'],
] as const) {
  if (!test) continue;
  checkUnique(
    label,
    test.map((q) => q.id),
  );
  for (const q of test) {
    if (q.program !== program) errors.push(`${label}: ${q.id} has program ${q.program}`);
    const index = q.answer.charCodeAt(0) - 'A'.charCodeAt(0);
    if (index >= q.options.length) errors.push(`${label}: ${q.id} answer ${q.answer} is outside options`);
    if (q.section === 'listening' && (!q.audio_script || !q.voice)) {
      errors.push(`${label}: ${q.id} listening question needs audio_script and voice`);
    }
  }
  if (scoring && test.length !== scoring[program].total) {
    errors.push(`${label}: has ${test.length} questions but scoring.json expects ${scoring[program].total}`);
  }
}

if (scoring) {
  for (const program of ['toeic', 'ielts'] as const) {
    const t = scoring[program].thresholds;
    if (t[0].min !== 0 || t[2].max !== scoring[program].total) {
      errors.push(`scoring.json: ${program} thresholds must cover 0..${scoring[program].total}`);
    }
    for (let i = 1; i < t.length; i++) {
      if (t[i].min !== t[i - 1].max + 1)
        errors.push(`scoring.json: ${program} thresholds have a gap or overlap`);
    }
  }
}

// Roadmaps
const STUDY_MIN = 120;
const STUDY_MAX = 180;
const OPTIONAL_DAY_MIN = 60;

const roadmapWeeks: Record<'toeic' | 'ielts', Week[]> = { toeic: [], ielts: [] };

for (const program of ['toeic', 'ielts'] as const) {
  const dir = join(root, 'roadmap', program);
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort();
  if (files.length !== 12) errors.push(`roadmap/${program}: expected 12 weeks, found ${files.length}`);
  const allowedSkills: readonly string[] = program === 'toeic' ? toeicSkills : ieltsSkills;
  const weeks = roadmapWeeks[program];
  for (const f of files) {
    const w = load(`roadmap/${program}/${f}`, weekSchema);
    if (w) weeks.push(w);
  }
  checkUnique(
    `roadmap/${program}`,
    weeks.flatMap((w) => w.days.flatMap((d) => d.tasks.map((t) => t.id))),
  );
  weeks.forEach((w, i) => {
    const label = `roadmap/${program}/week ${w.week}`;
    if (w.program !== program) errors.push(`${label}: program mismatch`);
    if (w.week !== i + 1) errors.push(`${label}: weeks must be numbered 1..12 in order`);
    if (!w.days.some((d) => d.tasks.some((t) => t.group_activity))) {
      errors.push(`${label}: needs at least one group activity`);
    }
    for (const d of w.days) {
      for (const t of d.tasks) {
        if (!allowedSkills.includes(t.skill)) errors.push(`${label}: task ${t.id} has skill ${t.skill}`);
      }
      for (const track of ['A', 'B', 'C'] as const) {
        const minutes = d.tasks
          .filter((t) => t.track === 'all' || t.track === track)
          .reduce((s, t) => s + t.minutes, 0);
        const min = d.day === 6 ? OPTIONAL_DAY_MIN : STUDY_MIN;
        if (minutes < min || minutes > STUDY_MAX) {
          errors.push(
            `${label} day ${d.day} track ${track}: ${minutes} minutes, expected ${min}-${STUDY_MAX}`,
          );
        }
      }
    }
  });
}

// Vocabulary
for (const program of ['toeic', 'ielts'] as const) {
  const deck = load(`vocab/${program}.json`, vocabDeckSchema);
  if (!deck) continue;
  checkUnique(
    `vocab/${program}.json`,
    deck.map((c) => c.id),
  );
  checkUnique(
    `vocab/${program}.json words`,
    deck.map((c) => c.word.toLowerCase()),
  );
  for (let week = 1; week <= 12; week++) {
    const count = deck.filter((c) => c.week === week).length;
    if (count < 15) errors.push(`vocab/${program}.json: week ${week} has only ${count} cards`);
  }
}

// IELTS Writing prompts and Speaking sets
const writingPrompts = load('prompts/ielts-writing.json', writingPromptsSchema);
const speakingSets = load('prompts/ielts-speaking.json', speakingSetsSchema);
if (writingPrompts) {
  checkUnique(
    'prompts/ielts-writing.json',
    writingPrompts.map((p) => p.id),
  );
  for (const p of writingPrompts) {
    const label = `prompts/ielts-writing.json: ${p.id}`;
    if (!p.id.startsWith(`w${String(p.week).padStart(2, '0')}-`))
      errors.push(`${label}: id does not match week`);
    if ((p.task === 1) !== Boolean(p.visuals))
      errors.push(`${label}: Task 1 needs visuals and Task 2 has none`);
    for (const v of p.visuals ?? []) {
      if (v.type === 'line' || v.type === 'bar') {
        for (const s of v.series) {
          if (s.values.length !== v.categories.length)
            errors.push(
              `${label}: series "${s.name}" has ${s.values.length} values for ${v.categories.length} categories`,
            );
        }
      }
      if (v.type === 'table') {
        for (const r of v.rows) {
          if (r.values.length !== v.columns.length)
            errors.push(`${label}: row "${r.label}" does not match the columns`);
        }
      }
      if (v.type === 'pie') {
        for (const pie of v.pies) {
          const sum = pie.slices.reduce((a, x) => a + x.value, 0);
          if (Math.abs(sum - 100) > 1) errors.push(`${label}: pie "${pie.caption}" adds up to ${sum}%`);
        }
      }
      if (v.type === 'map') {
        for (const m of v.maps) {
          for (const f of m.features) {
            if (f.x + f.w > 100 || f.y + f.h > 60)
              errors.push(`${label}: "${f.label}" is outside the 100 × 60 map`);
          }
        }
      }
    }
  }
  for (let week = 1; week <= 12; week++) {
    if (!writingPrompts.some((p) => p.week === week))
      errors.push(`prompts/ielts-writing.json: no prompt for week ${week}`);
  }
}
if (speakingSets) {
  checkUnique(
    'prompts/ielts-speaking.json',
    speakingSets.map((p) => p.id),
  );
  for (let week = 1; week <= 12; week++) {
    if (!speakingSets.some((p) => p.week === week))
      errors.push(`prompts/ielts-speaking.json: no set for week ${week}`);
  }
}

// Question banks (practice sets in the repo, plus mock tests in content-private/ when present)
const bankCounts: string[] = [];
let roadmapLinks = 0;
for (const course of BANK_COURSES) {
  const bank = loadBank(course);
  errors.push(...bank.errors);
  const count = (pool: string) =>
    bank.files.reduce(
      (sum, f) =>
        sum + f.file.sets.filter((s) => s.pool === pool).reduce((k, s) => k + s.questions.length, 0),
      0,
    );
  const mock = count('mock');
  bankCounts.push(`${course} ${count('practice')}${mock ? ` + ${mock} mock` : ''}`);

  // "Làm ngay" links: every tag exists and the bank has enough questions for each count.
  const knownTags = new Set(Object.keys(bank.taxonomy?.tags ?? {}));
  const practiceQuestions = bank.files.flatMap((f) =>
    f.file.sets.filter((s) => s.pool !== 'mock').flatMap((s) => s.questions),
  );
  const available = (tags: string[]) =>
    practiceQuestions.filter((q) => (q.tags ?? []).some((t) => tags.includes(t))).length;
  const mockWeeks = new Set(bank.mocks.map((m) => m.mock.week));
  for (const w of roadmapWeeks[course]) {
    for (const d of w.days) {
      for (const t of d.tasks) {
        const link = t.practice;
        if (!link) continue;
        roadmapLinks += 1;
        const label = `roadmap/${course}/week ${w.week}: task ${t.id}`;
        const parts =
          link.kind === 'practice'
            ? [{ tags: link.tags, count: link.count }]
            : link.kind === 'exam'
              ? link.parts
              : [];
        for (const part of parts) {
          for (const tag of part.tags) {
            if (!knownTags.has(tag)) errors.push(`${label}: unknown tag "${tag}"`);
          }
          const n = available(part.tags);
          if (n < part.count) {
            errors.push(
              `${label}: needs ${part.count} questions tagged ${part.tags.join('|')}, the bank has ${n}`,
            );
          }
        }
        if (link.kind === 'writing' || link.kind === 'speaking' || link.kind === 'review') {
          if (course !== 'ielts') errors.push(`${label}: ${link.kind} links exist only for IELTS`);
          const has =
            link.kind === 'writing'
              ? (writingPrompts ?? []).some((p) => p.week === w.week)
              : link.kind === 'speaking'
                ? (speakingSets ?? []).some((p) => p.week === w.week)
                : true;
          if (!has) errors.push(`${label}: no ${link.kind} prompt for week ${w.week}`);
        }
        if (link.kind === 'mock') {
          if (!d.mock_test) errors.push(`${label}: a mock link belongs on a mock test day`);
          // Mock tests live in content-private/, so only check them where they are present.
          if (bank.mocks.length > 0 && !mockWeeks.has(w.week)) {
            console.warn(`  note: ${label} links to the week ${w.week} mock test, which is not written yet`);
          }
        }
      }
    }
  }
}

if (errors.length > 0) {
  console.error(`Content validation failed with ${errors.length} error(s):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(
  `Content OK: placement tests, 24 roadmap weeks, vocabulary decks, ${writingPrompts?.length ?? 0} Writing prompts, ${speakingSets?.length ?? 0} Speaking sets, question banks (${bankCounts.join(', ')} questions) and ${roadmapLinks} "Làm ngay" links are valid.`,
);
