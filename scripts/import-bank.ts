/**
 * Imports the TOEIC and IELTS question banks into Supabase.
 *
 * Reads content/bank/<course>/ (practice sets, committed) and, when present,
 * content-private/ (mock tests, never committed), checks everything with the
 * same rules as `npm run validate:content`, then upserts through the
 * service-role-only functions ot_bank_upsert_taxonomy / _set / _mock.
 *
 *   SUPABASE_URL=...  SUPABASE_SERVICE_ROLE_KEY=...  npx tsx scripts/import-bank.ts [toeic|ielts]
 *
 * Runs in the bank-sync workflow on every change to content/bank/** on main.
 * Safe to re-run: rows are matched by their content id.
 */
import { createClient } from '@supabase/supabase-js';
import { BANK_COURSES, loadBank, type BankCourse } from './bank-content.ts';

const env = (name: string, fallback?: string) => {
  const v = process.env[name] ?? fallback;
  if (!v) throw new Error(`Missing environment variable ${name}`);
  return v;
};

const supabase = createClient(
  env('SUPABASE_URL', process.env.VITE_SUPABASE_URL),
  env('SUPABASE_SERVICE_ROLE_KEY'),
  {
    auth: { persistSession: false },
  },
);

async function rpc(fn: string, args: Record<string, unknown>) {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(`${fn}: ${error.message}`);
  return data as unknown;
}

async function importCourse(course: BankCourse) {
  const bank = loadBank(course);
  if (bank.errors.length > 0) {
    throw new Error(
      `${course}: content has ${bank.errors.length} problem(s):\n  ${bank.errors.join('\n  ')}`,
    );
  }
  await rpc('ot_bank_upsert_taxonomy', { p_course: course, p_taxonomy: bank.taxonomy });
  let questions = 0;
  let sets = 0;
  for (const { path, file } of bank.files) {
    for (const set of file.sets) {
      questions += Number(await rpc('ot_bank_upsert_set', { p_course: course, p_source: path, p_set: set }));
      sets += 1;
    }
  }
  for (const { mock } of bank.mocks) {
    await rpc('ot_bank_upsert_mock', { p_course: course, p_mock: mock });
  }
  console.log(`${course}: ${sets} sets, ${questions} questions, ${bank.mocks.length} mock test(s)`);
}

const only = process.argv[2] as BankCourse | undefined;
if (only && !BANK_COURSES.includes(only)) throw new Error(`Unknown course ${only}`);
for (const course of only ? [only] : BANK_COURSES) await importCourse(course);
