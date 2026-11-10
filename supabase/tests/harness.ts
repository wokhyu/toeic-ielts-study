import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';

/**
 * Runs the real migrations on an in-memory Postgres (PGlite) with a minimal
 * stand-in for the parts of Supabase they depend on: the anon/authenticated
 * roles, auth.users, auth.uid(), storage.buckets and Supabase's default grants.
 */
const SUPABASE_STUB = `
  create role anon nologin;
  create role authenticated nologin;
  create schema auth;
  create table auth.users (
    id uuid primary key,
    email text,
    raw_user_meta_data jsonb not null default '{}',
    created_at timestamptz not null default now(),
    last_sign_in_at timestamptz
  );
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean);
  grant usage on schema public, auth to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant all on sequences to anon, authenticated;
  alter default privileges in schema public grant execute on functions to anon, authenticated;
`;

const migrationsDir = join(import.meta.dirname, '..', 'migrations');

export interface TestDb {
  db: PGlite;
  /** Create an auth user (fires the profile trigger) and return its id. */
  signUp(email: string, displayName?: string): Promise<string>;
  makeAdmin(userId: string): Promise<void>;
  /** Run `fn` as the given signed-in user, with RLS and grants enforced. */
  as<T>(userId: string, fn: () => Promise<T>): Promise<T>;
  /** Shorthand: run one query as a user and return its rows. */
  q<T = Record<string, unknown>>(userId: string, sql: string, params?: unknown[]): Promise<T[]>;
}

let counter = 0;

export async function createTestDb(): Promise<TestDb> {
  const db = new PGlite();
  await db.exec(SUPABASE_STUB);
  for (const file of readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort()) {
    await db.exec(readFileSync(join(migrationsDir, file), 'utf8'));
  }

  const as = async <T>(userId: string, fn: () => Promise<T>): Promise<T> => {
    await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [userId]);
    await db.exec('set role authenticated');
    try {
      return await fn();
    } finally {
      await db.exec('reset role');
      await db.query(`select set_config('request.jwt.claim.sub', '', false)`);
    }
  };

  return {
    db,
    async signUp(email, displayName) {
      counter += 1;
      const id = `00000000-0000-4000-8000-${String(counter).padStart(12, '0')}`;
      await db.query('insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)', [
        id,
        email,
        JSON.stringify(displayName ? { display_name: displayName } : {}),
      ]);
      return id;
    },
    async makeAdmin(userId) {
      await db.query(`update public.profiles set role = 'admin' where id = $1`, [userId]);
    },
    as,
    async q(userId, sql, params) {
      return as(userId, async () => (await db.query(sql, params)).rows as never);
    },
  };
}
