/**
 * Imports the on-tap-11 question bank into Supabase.
 *
 * Source: the SQLite database built by courses/on-tap-11/pipeline (or a backup of
 * the former app's quiz.db). Run on your own machine; it needs the service role key,
 * which bypasses RLS and must never be committed or used in the browser.
 *
 *   SUPABASE_URL=...  SUPABASE_SERVICE_ROLE_KEY=...  OT11_SQLITE_PATH=path/to/quiz.db \
 *   OT11_MEDIA_DIR=courses/on-tap-11/build/media   (or OT11_MEDIA_BASE=https://old-site) \
 *   npx tsx scripts/import-on-tap-11.ts [--skip-media] [--only-media]
 *
 * Safe to re-run: rows are upserted by id and existing media files are skipped.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createClient } from '@supabase/supabase-js';

const env = (name: string, fallback?: string) => {
  const v = process.env[name] ?? fallback;
  if (!v) throw new Error(`Missing environment variable ${name}`);
  return v;
};

const url = env('SUPABASE_URL', process.env.VITE_SUPABASE_URL);
const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY');
const sqlitePath = env('OT11_SQLITE_PATH');
const mediaDir = process.env.OT11_MEDIA_DIR;
const mediaBase = process.env.OT11_MEDIA_BASE?.replace(/\/$/, '');
const skipMedia = process.argv.includes('--skip-media');
const onlyMedia = process.argv.includes('--only-media');

const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });
const sqlite = new DatabaseSync(sqlitePath, { readOnly: true });

type Row = Record<string, unknown>;
const all = (sql: string) => sqlite.prepare(sql).all() as Row[];
const json = (v: unknown) => (typeof v === 'string' && v !== '' ? JSON.parse(v) : null);

async function upsert(table: string, rows: Row[], onConflict = 'id', size = 500) {
  for (let i = 0; i < rows.length; i += size) {
    const { error } = await supabase.from(table).upsert(rows.slice(i, i + size), { onConflict });
    if (error) throw new Error(`${table}: ${error.message}`);
    process.stdout.write(`\r${table}: ${Math.min(i + size, rows.length)}/${rows.length}`);
  }
  process.stdout.write('\n');
}

async function importRows() {
  await upsert('ot_subjects', all('select id, slug, name, sort from subjects'));
  await upsert('ot_chapters', all('select id, subject_id, slug, name, sort from chapters'));
  await upsert('ot_topics', all('select id, chapter_id, slug, name, sort from topics'));
  await upsert('ot_sources', all('select id, path, subject_id, title from sources'));

  const questions = all(
    `select id, topic_id, source_id, number_in_source, type, stem_html, solution_html,
            answer_key, answer_source, difficulty, content_hash, status, flags from questions`,
  );
  await upsert(
    'ot_questions',
    questions.map((q) => ({
      id: q.id,
      topic_id: q.topic_id,
      source_id: q.source_id,
      number_in_source: q.number_in_source,
      type: q.type,
      stem_html: q.stem_html,
      difficulty: q.difficulty,
      status: q.status,
      flags: json(q.flags),
      content_hash: q.content_hash,
    })),
  );
  await upsert(
    'ot_question_keys',
    questions.map((q) => ({
      question_id: q.id,
      answer_key: json(q.answer_key),
      answer_source: q.answer_source,
      solution_html: q.solution_html ?? '',
    })),
    'question_id',
  );
  await upsert('ot_options', all('select id, question_id, label, html, sort from options'), 'id', 1000);
}

function mediaPaths(): string[] {
  const found = new Set<string>();
  const re = /src="\/media\/([^"]+)"/g;
  const scan = (html: unknown) => {
    if (typeof html !== 'string') return;
    for (const m of html.matchAll(re)) found.add(m[1]);
  };
  for (const r of all('select stem_html, solution_html from questions')) {
    scan(r.stem_html);
    scan(r.solution_html);
  }
  for (const r of all('select html from options')) scan(r.html);
  return [...found].sort();
}

const CONTENT_TYPES: Record<string, string> = {
  png: 'image/png',
  gif: 'image/gif',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  wmf: 'image/wmf',
  emf: 'image/emf',
  svg: 'image/svg+xml',
};

async function readMedia(path: string): Promise<Buffer> {
  if (mediaDir) {
    const file = join(mediaDir, ...path.split('/'));
    if (existsSync(file)) return readFileSync(file);
  }
  if (!mediaBase) throw new Error('Set OT11_MEDIA_DIR or OT11_MEDIA_BASE to import media');
  const res = await fetch(`${mediaBase}/media/${path}`);
  if (!res.ok) throw new Error(`GET /media/${path}: HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function importMedia() {
  const paths = mediaPaths();
  let done = 0;
  let skipped = 0;
  const failed: string[] = [];
  const queue = [...paths];
  const worker = async () => {
    for (let path = queue.shift(); path; path = queue.shift()) {
      try {
        const ext = path.split('.').pop()?.toLowerCase() ?? '';
        const body = await readMedia(path);
        const { error } = await supabase.storage.from('ot-media').upload(path, body, {
          contentType: CONTENT_TYPES[ext] ?? 'application/octet-stream',
          upsert: false,
        });
        if (error && !/exists|duplicate/i.test(error.message)) throw error;
        if (error) skipped += 1;
      } catch (e) {
        failed.push(`${path}: ${(e as Error).message}`);
      }
      done += 1;
      if (done % 100 === 0 || done === paths.length) {
        process.stdout.write(
          `\rmedia: ${done}/${paths.length} (${skipped} already there, ${failed.length} failed)`,
        );
      }
    }
  };
  await Promise.all(Array.from({ length: 8 }, worker));
  process.stdout.write('\n');
  if (failed.length > 0) {
    console.error(
      `${failed.length} media file(s) failed. First ones:\n  ${failed.slice(0, 10).join('\n  ')}`,
    );
    process.exitCode = 1;
  }
}

if (!onlyMedia) await importRows();
if (!skipMedia) await importMedia();
console.log('Import finished.');
