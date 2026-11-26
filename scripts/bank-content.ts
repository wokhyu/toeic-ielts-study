import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { z } from 'zod';
import { checkBank } from '../src/content/bank-check.ts';
import {
  bankFileSchema,
  bankMockSchema,
  bankTaxonomySchema,
  type BankFile,
  type BankMock,
  type BankTaxonomy,
} from '../src/content/bank-schema.ts';
import { weekSchema } from '../src/content/schema.ts';

export const BANK_COURSES = ['toeic', 'ielts'] as const;
export type BankCourse = (typeof BANK_COURSES)[number];

export interface BankContent {
  course: BankCourse;
  taxonomy: BankTaxonomy | undefined;
  files: { path: string; file: BankFile }[];
  mocks: { path: string; mock: BankMock }[];
  errors: string[];
}

const jsonFiles = (dir: string) =>
  existsSync(dir)
    ? readdirSync(dir)
        .filter((f) => f.endsWith('.json'))
        .sort()
        .map((f) => join(dir, f))
    : [];

/**
 * Reads one course's bank: content/bank/<course>/ (public practice sets and
 * taxonomy.json) plus, when present on this machine, content-private/bank/<course>/
 * (mock sets) and content-private/mocks/<course>-*.json (mock test definitions).
 */
export function loadBank(course: BankCourse, root = process.cwd()): BankContent {
  const errors: string[] = [];
  const parse = <T>(file: string, schema: z.ZodType<T>): T | undefined => {
    const rel = relative(root, file).replaceAll('\\', '/');
    let raw: unknown;
    try {
      raw = JSON.parse(readFileSync(file, 'utf8'));
    } catch (e) {
      errors.push(`${rel}: ${(e as Error).message}`);
      return undefined;
    }
    const result = schema.safeParse(raw);
    if (!result.success) {
      for (const issue of result.error.issues)
        errors.push(`${rel}: ${issue.path.join('.')}: ${issue.message}`);
      return undefined;
    }
    return result.data;
  };

  const publicDir = join(root, 'content', 'bank', course);
  const taxonomyPath = join(publicDir, 'taxonomy.json');
  const taxonomy = existsSync(taxonomyPath) ? parse(taxonomyPath, bankTaxonomySchema) : undefined;
  if (!taxonomy) errors.push(`content/bank/${course}/taxonomy.json is missing or invalid`);

  const files: BankContent['files'] = [];
  for (const file of [
    ...jsonFiles(publicDir).filter((f) => !f.endsWith('taxonomy.json')),
    ...jsonFiles(join(root, 'content-private', 'bank', course)),
  ]) {
    const parsed = parse(file, bankFileSchema);
    if (parsed) files.push({ path: relative(root, file).replaceAll('\\', '/'), file: parsed });
  }

  const mocks: BankContent['mocks'] = [];
  for (const file of jsonFiles(join(root, 'content-private', 'mocks')).filter((f) =>
    f.split(/[\\/]/).pop()?.startsWith(`${course}-`),
  )) {
    const parsed = parse(file, bankMockSchema);
    if (parsed) mocks.push({ path: relative(root, file).replaceAll('\\', '/'), mock: parsed });
  }

  if (taxonomy) errors.push(...checkBank(course, taxonomy, files, mocks));
  return { course, taxonomy, files, mocks, errors };
}

/** Roadmap tasks of one course as reference rows for the roadmap_tasks table. */
export function loadRoadmapTasks(course: BankCourse, root = process.cwd()) {
  const dir = join(root, 'content', 'roadmap', course);
  return jsonFiles(dir).flatMap((file) => {
    const week = weekSchema.parse(JSON.parse(readFileSync(file, 'utf8')));
    return week.days.flatMap((d) =>
      d.tasks.map((t) => ({
        id: t.id,
        week: week.week,
        day: d.day,
        skill: t.skill,
        track: t.track,
        minutes: t.minutes,
        title: t.title,
        group_activity: t.group_activity,
      })),
    );
  });
}
