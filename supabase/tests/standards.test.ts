// @vitest-environment node
import { beforeAll, describe, expect, it } from 'vitest';
import { createTestDb, type TestDb } from './harness.ts';

// Database conventions, checked on the real migrations so later ones cannot
// quietly break them. They follow the Supabase database advisors.
let t: TestDb;

beforeAll(async () => {
  t = await createTestDb();
});

const rows = async <T>(sql: string) => (await t.db.query<T>(sql)).rows;

// Functions the browser (role authenticated) may call. Everything else is an
// internal helper and must not be executable from the API.
const CALLABLE = [
  'admin_list_users()',
  'admin_set_enrollment(p_user uuid, p_course text, p_status text, p_track text, p_start_date date)',
  'admin_set_role(p_user uuid, p_role text)',
  'get_leaderboard(p_course text)',
  'is_admin()',
  'is_enrolled(p_course text)',
  'ot_admin_set_key(p_question integer, p_key jsonb, p_status text)',
  'ot_answer_practice(p_question integer, p_response jsonb, p_time_ms integer, p_mode text)',
  'ot_attempt_questions(p_attempt bigint)',
  'ot_attempt_review(p_attempt bigint)',
  'ot_reveal(p_question integer)',
  'ot_save_answer(p_attempt bigint, p_question integer, p_response jsonb)',
  'ot_start_exam(p_topic_ids integer[], p_count integer, p_minutes integer, p_types text[])',
  'ot_start_mock(p_test text)',
  'ot_submit_exam(p_attempt bigint)',
  'ot_tag_question_ids(p_course text, p_tag text, p_limit integer)',
  'ot_toggle_bookmark(p_question integer)',
  'ot_topic_question_ids(p_topic integer, p_limit integer, p_offset integer)',
  'ot_topic_tree(p_course text)',
  'ot_wrong_question_ids(p_limit integer, p_course text)',
  'request_enrollment(p_course text)',
];

describe('database standards', () => {
  it('indexes every foreign key', async () => {
    const missing = await rows<{ fk: string }>(`
      select c.conrelid::regclass || '.' || c.conname as fk
        from pg_constraint c
       where c.contype = 'f' and c.connamespace = 'public'::regnamespace
         and not exists (
           select 1 from pg_index i
            where i.indrelid = c.conrelid
              and (string_to_array(i.indkey::text, ' ')::int2[])[1:array_length(c.conkey, 1)] = c.conkey
         )
       order by 1`);
    expect(missing.map((r) => r.fk)).toEqual([]);
  });

  it('evaluates auth.uid() and is_admin() once per query in RLS policies', async () => {
    const policies = await rows<{ name: string; expr: string }>(`
      select tablename || ': ' || policyname as name, coalesce(qual, '') || ' ' || coalesce(with_check, '') as expr
        from pg_policies where schemaname = 'public'`);
    const bare = policies.filter((p) => {
      const expr = p.expr
        .replaceAll('( SELECT auth.uid() AS uid)', '')
        .replaceAll('( SELECT is_admin() AS is_admin)', '');
      return /auth\.uid\(\)|is_admin\(\)/.test(expr);
    });
    expect(bare.map((p) => p.name)).toEqual([]);
  });

  it('enables RLS on every table', async () => {
    const open = await rows<{ name: string }>(`
      select relname as name from pg_class
       where relnamespace = 'public'::regnamespace and relkind = 'r' and not relrowsecurity`);
    expect(open.map((r) => r.name)).toEqual([]);
  });

  it('documents every table and view', async () => {
    const undocumented = await rows<{ name: string }>(`
      select relname as name from pg_class
       where relnamespace = 'public'::regnamespace and relkind in ('r', 'v')
         and obj_description(oid, 'pg_class') is null
       order by 1`);
    expect(undocumented.map((r) => r.name)).toEqual([]);
  });

  it('lets the API call only the intended functions', async () => {
    const fns = (role: string) =>
      rows<{ fn: string }>(`
        select p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as fn
          from pg_proc p
         where p.pronamespace = 'public'::regnamespace
           and p.prorettype <> 'trigger'::regtype
           and has_function_privilege('${role}', p.oid, 'execute')
         order by 1`);
    expect((await fns('anon')).map((r) => r.fn)).toEqual([]);
    expect((await fns('authenticated')).map((r) => r.fn)).toEqual([...CALLABLE].sort());
  });

  it('pins search_path on every security definer function', async () => {
    const unpinned = await rows<{ name: string }>(`
      select proname as name from pg_proc
       where pronamespace = 'public'::regnamespace and prosecdef
         and not exists (select 1 from unnest(proconfig) c where c like 'search_path=%')`);
    expect(unpinned.map((r) => r.name)).toEqual([]);
  });
});
