import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(url && anonKey);

/** Null when the site is built without Supabase settings (course previews still work). */
// PKCE keeps the auth redirect in the query string (?code=...), so it does not clash with the hash router.
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url!, anonKey!, { auth: { flowType: 'pkce' } })
  : null;

export function db(): SupabaseClient {
  if (!supabase) throw new Error('Supabase chưa được cấu hình');
  return supabase;
}

/** Base URL of the public bucket holding on-tap-11 formula images. */
export const otMediaBase = url ? `${url.replace(/\/$/, '')}/storage/v1/object/public/ot-media/` : '/media/';

export function errorMessage(e: unknown): string {
  if (e && typeof e === 'object' && 'message' in e) return String((e as { message: unknown }).message);
  return String(e);
}
