import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { z } from 'zod';
import {
  ieltsSkills,
  placementTestSchema,
  productiveTestSchema,
  scoringSchema,
  toeicSkills,
  vocabDeckSchema,
  weekSchema,
  type Week,
} from '../src/content/schema.ts';

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
  checkUnique(label, test.map((q) => q.id));
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
      if (t[i].min !== t[i - 1].max + 1) errors.push(`scoring.json: ${program} thresholds have a gap or overlap`);
    }
  }
}

// Roadmaps
const STUDY_MIN = 120;
const STUDY_MAX = 180;
const OPTIONAL_DAY_MIN = 60;

for (const program of ['toeic', 'ielts'] as const) {
  const dir = join(root, 'roadmap', program);
  const files = readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
  if (files.length !== 12) errors.push(`roadmap/${program}: expected 12 weeks, found ${files.length}`);
  const allowedSkills: readonly string[] = program === 'toeic' ? toeicSkills : ieltsSkills;
  const weeks: Week[] = [];
  for (const f of files) {
    const w = load(`roadmap/${program}/${f}`, weekSchema);
    if (w) weeks.push(w);
  }
  checkUnique(`roadmap/${program}`, weeks.flatMap((w) => w.days.flatMap((d) => d.tasks.map((t) => t.id))));
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
          errors.push(`${label} day ${d.day} track ${track}: ${minutes} minutes, expected ${min}-${STUDY_MAX}`);
        }
      }
    }
  });
}

// Vocabulary
for (const program of ['toeic', 'ielts'] as const) {
  const deck = load(`vocab/${program}.json`, vocabDeckSchema);
  if (!deck) continue;
  checkUnique(`vocab/${program}.json`, deck.map((c) => c.id));
  checkUnique(`vocab/${program}.json words`, deck.map((c) => c.word.toLowerCase()));
  for (let week = 1; week <= 12; week++) {
    const count = deck.filter((c) => c.week === week).length;
    if (count < 15) errors.push(`vocab/${program}.json: week ${week} has only ${count} cards`);
  }
}

if (errors.length > 0) {
  console.error(`Content validation failed with ${errors.length} error(s):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log('Content OK: placement tests, 24 roadmap weeks and vocabulary decks are valid.');
